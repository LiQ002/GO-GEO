import { app, type WebContents } from 'electron'
import type {
  PublishArticleInput,
  PublishArticleResult,
} from '../../../lib/platforms/types'
import type { PublishProgressEvent } from '../../../lib/ipc-contract'
import {
  isMediaPlatform,
  requirePlatform,
  resolvePlatformKind,
  type PlatformKind,
} from '../../../lib/platforms/unified'
import { createLogger } from '../logger'
import { authService } from './AuthService'
import { sessionManager } from './SessionManager'
import fs from 'node:fs'
import path from 'node:path'

const log = createLogger('PublishService')

async function waitForPageStable(page: import('puppeteer').Page, stableMs = 1_000, timeout = 15_000) {
  const start = Date.now()
  let lastUrl = page.url()
  while (Date.now() - start < timeout) {
    await new Promise((resolve) => setTimeout(resolve, stableMs))
    const currentUrl = page.url()
    if (currentUrl === lastUrl) return
    lastUrl = currentUrl
  }
  log.warn('Page URL did not stabilize within timeout', { url: lastUrl })
}

function getEvidenceDirectory(): string {
  const evidenceDirectory = path.join(app.getPath('userData'), 'evidence', 'publish')
  fs.mkdirSync(evidenceDirectory, { recursive: true })
  return evidenceDirectory
}

async function saveEvidenceScreenshot(page: import('puppeteer').Page, prefix: string) {
  try {
    const filePath = path.join(getEvidenceDirectory(), `${prefix}-${Date.now()}.png`)
    await page.screenshot({ path: filePath, fullPage: true })
    log.info('Evidence screenshot saved', { filePath })
    return filePath
  } catch (err) {
    log.warn('Failed to save evidence screenshot', { error: String(err) })
    return undefined
  }
}

const PUBLISHED_URL_PATTERNS: Record<string, RegExp[]> = {
  zhihu: [/zhuanlan\.zhihu\.com\/p\//, /\/answer\//, /\/question\//],
  wechat: [/mp\.weixin\.qq\.com/, /mp\.weixin\.qq\.com\/s\//],
  toutiao: [/toutiao\.com\/article\//, /www\.toutiao\.com\/article\//],
  xueqiu: [/xueqiu\.com\/\d+\/status\//],
  bilibili: [/bilibili\.com\/read\/cv\d+\//, /bilibili\.com\/video\/BV/],
  xiaohongshu: [/xiaohongshu\.com\/explore\//],
  jinritemai: [/jinritemai\.com\/video\//],
  csdn: [/mp\.csdn\.net\/mp_blog\/article\//, /blog\.csdn\.net\//],
  // 搜狐号发布成功后跳转到文章管理列表页（addarticle 是编辑页，必须排除）
  sohu: [/mp\.sohu\.com\/mpfe\/v4\/contentManagement\/news\/articleList/],
}

function isLikelyPublishedUrl(url: string, platformName: string): boolean {
  const patterns = PUBLISHED_URL_PATTERNS[platformName] || []
  if (patterns.length === 0) {
    // 无明确发布成功 URL 模式时走保守判断：URL 非空 + 不在编辑/创建/登录页。
    // 加 addarticle / addmoment / create 等编辑页关键字，避免编辑页 URL 被误判为"已发布"。
    return !!url && url.length > 0
      && !url.includes('write') && !url.includes('edit')
      && !url.includes('login') && !url.includes('passport')
      && !url.includes('addarticle') && !url.includes('addmoment')
      && !url.includes('newarticle') && !url.includes('create')
      && !url.includes('draft')
  }
  return patterns.some((p) => p.test(url))
}

export class PublishService {
  private getProgressTarget: (() => WebContents) | null = null

  setProgressTarget(getWebContents: () => WebContents) {
    this.getProgressTarget = getWebContents
  }

  emitProgress(event: PublishProgressEvent) {
    log.info('Publish progress', event)
    try {
      this.getProgressTarget?.().send('publish:progress', event)
    } catch (err) {
      log.warn('Unable to deliver publish progress', { error: String(err) })
    }
  }

  async openPublish(params: {
    platformName: string
    encryptedSecret: string
    kind?: PlatformKind
  }) {
    log.info('Opening publish page', { platformName: params.platformName })

    const { sessionId } = await authService.prepareAuthenticatedPage({
      platformId: params.platformName,
      encryptedSecret: params.encryptedSecret,
      kind: params.kind,
    })

    return { ok: true as const, sessionId }
  }

  async publishArticle(
    params: {
      platformName: string
      encryptedSecret: string
      article: PublishArticleInput
      kind?: PlatformKind
      sessionId?: string
      loginUrl?: string
    },
    options: { silent?: boolean } = {},
  ) {
    const kind = params.kind ?? resolvePlatformKind(params.platformName)
    const emit = (event: PublishProgressEvent) => {
      if (!options.silent) this.emitProgress(event)
    }
    emit({
      type: 'start',
      platformName: params.platformName,
      message: '正在打开发布页',
      done: 0,
      total: 3,
    })

    let session = params.sessionId ? sessionManager.get(params.sessionId) : undefined
    try {
      if (params.sessionId && !session) {
        throw new Error('发布会话已失效，请重新打开平台登录窗口')
      }
      if (!session) {
        const prepared = await authService.prepareAuthenticatedPage({
          platformId: params.platformName,
          encryptedSecret: params.encryptedSecret,
          kind,
          loginUrl: params.loginUrl,
        })
        session = sessionManager.get(prepared.sessionId)
      }

      if (!session) {
        throw new Error('Failed to create publish session')
      }

      const platform = requirePlatform(params.platformName, kind)

      if (!isMediaPlatform(platform)) {
        throw new Error('Automatic publish is only supported for media platforms')
      }

      if (params.sessionId) {
        if (session.platformId !== params.platformName || session.kind !== kind) {
          throw new Error('发布会话与目标平台不匹配')
        }
        if (platform.assertAuthenticated) {
          await platform.assertAuthenticated(session.page)
        }

        const targetUrl = platform.buildPublishUrl
          ? platform.buildPublishUrl(session.page.url())
          : platform.publishUrl
        // 等待页面主文档及后续可能的跳转/重载稳定，避免 evaluate 时 context 被销毁
        await session.page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30_000 })
        await waitForPageStable(session.page, 1_000)
        if (platform.afterOpenPublish) {
          await platform.afterOpenPublish(session.page, session.browser)
        }
        session.platformUrl = session.page.url()
      }

      if (!platform.publishArticle) {
        throw new Error(`Platform ${params.platformName} does not support automatic publish`)
      }

      emit({
        type: 'progress',
        platformName: params.platformName,
        message: '正在填写文章内容',
        done: 1,
        total: 3,
      })

      const publishResult = await platform.publishArticle(session.page, params.article)
      const structuredResult =
        publishResult && typeof publishResult === 'object'
          ? (publishResult as PublishArticleResult)
          : undefined
      const publishedUrl =
        (typeof publishResult === 'string' ? publishResult.trim() : '') ||
        structuredResult?.publishedUrl?.trim() ||
        session.page.url()
      const platformArticleId = structuredResult?.platformArticleId?.trim() || undefined
      await saveEvidenceScreenshot(session.page, `publish-success-${params.platformName}`)

      emit({
        type: 'progress',
        platformName: params.platformName,
        message: '正在提交发布',
        done: 2,
        total: 3,
      })

      emit({
        type: 'complete',
        platformName: params.platformName,
        message: '发布完成',
        done: 3,
        total: 3,
      })

      log.info('Article published', {
        platformName: params.platformName,
        publishedUrl,
        platformArticleId,
      })
      return {
        ok: true as const,
        sessionId: session.sessionId,
        publishedUrl,
        platformArticleId,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      let pageUrl: string | undefined
      try {
        if (session?.page && !session.page.isClosed()) {
          pageUrl = session.page.url()
        }
      } catch {
        // Context destroyed - try to recover URL from error message
        const urlMatch = message.match(/https?:\/\/[^\s)]+/i)
        if (urlMatch) pageUrl = urlMatch[0]
      }

      // Check if publish actually succeeded despite the error
      const likelyPublished = pageUrl && isLikelyPublishedUrl(pageUrl, params.platformName)
      if (likelyPublished) {
        log.info('Publish succeeded despite context error', {
          platformName: params.platformName,
          publishedUrl: pageUrl,
          error: message,
        })
        if (session?.page) {
          await saveEvidenceScreenshot(session.page, `publish-success-${params.platformName}`)
        }
        emit({
          type: 'progress',
          platformName: params.platformName,
          message: '发布完成',
          done: 3,
          total: 3,
        })
        emit({
          type: 'complete',
          platformName: params.platformName,
          message: '发布完成',
          done: 3,
          total: 3,
        })
        return {
          ok: true as const,
          sessionId: session?.sessionId,
          publishedUrl: pageUrl,
          platformArticleId: undefined,
        }
      }

      log.error('Publish failed', { platformName: params.platformName, error: message, pageUrl })
      if (session?.page) await saveEvidenceScreenshot(session.page, `publish-failed-${params.platformName}`)
      if (session && !params.sessionId) await sessionManager.closeOne(session.sessionId)
      emit({
        type: 'error',
        platformName: params.platformName,
        message: `${message}${pageUrl ? ` (${pageUrl})` : ''}`,
      })
      return { ok: false as const, message: `${message}${pageUrl ? ` (${pageUrl})` : ''}` }
    }
  }
}

export const publishService = new PublishService()
