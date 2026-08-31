'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Play, RefreshCw } from 'lucide-react'
import { StatCard } from '@/components/ui/Card'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/Section'
import Button from '@/components/ui/Button'
import { TaskStatusBadge } from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import Empty from '@/components/ui/Empty'
import MediaPublishDemo from './MediaPublishDemo'
import {
  claimOperatorPublishTask,
  ensureOperatorWorkerToken,
  getApiErrorMessage,
  getOperatorPublishTasks,
  heartbeatOperatorWorker,
  releaseOperatorPublishTask,
  renewOperatorPublishTask,
  reportOperatorPublishResult,
  retryOperatorPublishTask,
} from '@/lib/api'
import type { OperatorTaskLease } from '@/lib/api'
import { getPlatformDriverId } from '@/lib/platform-manifest'
import { getDeviceId } from '@/lib/device-id'
import type { PublishJobResult } from '@/lib/ipc-contract'
import type { PublishTask } from '@/types/app'
import { useAppStore } from '@/lib/store/useAppStore'

// 服务端租约有效期 120s，续租间隔需远小于租约时长，确保单次续租失败后下次仍在有效期内。
const RENEW_INTERVAL_MS = 45_000

function decodeCredentialPayload(payload?: string): string {
  if (!payload) return ''
  try {
    return atob(payload)
  } catch {
    return payload
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderInlineMarkdown(text: string): string {
  return (
    escapeHtml(text)
      // 图片 ![alt](url) —— alt 置空，避免把处理后的文件名暴露到正文
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="">')
      // 链接 [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // 加粗 **text** 或 __text__
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      // 斜体 *text* 或 _text_
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
      .replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>')
      // 行内代码
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  )
}

function renderMarkdownToHTML(md: string): string {
  if (!md) return ''
  const lines = md.split('\n')
  const blocks: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // 代码块
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(escapeHtml(lines[i]))
        i++
      }
      i++
      blocks.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${codeLines.join('\n')}</code></pre>`)
      continue
    }

    // 标题 h1-h6
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`)
      i++
      continue
    }

    // 无序列表
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${renderInlineMarkdown(lines[i].replace(/^[-*+]\s+/, ''))}</li>`)
        i++
      }
      blocks.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    // 有序列表
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${renderInlineMarkdown(lines[i].replace(/^\d+\.\s+/, ''))}</li>`)
        i++
      }
      blocks.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    // 空行
    if (!line.trim()) {
      i++
      continue
    }

    // 段落：合并连续非空行
    const paragraphLines: string[] = []
    while (i < lines.length && lines[i].trim()) {
      paragraphLines.push(lines[i])
      i++
    }
    const content = paragraphLines.join(' ').replace(/  +/g, ' ')
    blocks.push(`<p>${renderInlineMarkdown(content)}</p>`)
  }

  return blocks.join('')
}

export default function OperatorPublishing() {
  const [tasks, setTasks] = useState<PublishTask[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const addToast = useAppStore((state) => state.addToast)

  const load = useCallback(() => {
    return getOperatorPublishTasks()
      .then(setTasks)
      .catch(() => addToast('error', '获取发布任务失败'))
  }, [addToast])

  useEffect(() => {
    load().finally(() => setLoading(false))
    const interval = setInterval(() => void load(), 5000)
    return () => clearInterval(interval)
  }, [load])

  const runTask = async (task: PublishTask) => {
    const api = window.electronAPI?.publishJobs
    if (!api) throw new Error('Electron 发布执行器不可用')
    if (!task.enterpriseId || !task.articleSnapshotId || !task.platforms?.length) {
      throw new Error(`任务 #${task.id} 缺少企业、文章快照或平台信息`)
    }

    if (task.status === 'failed') {
      await retryOperatorPublishTask(task)
    }

    const nodeId = getDeviceId()
    const workerToken = await ensureOperatorWorkerToken(nodeId)

    await heartbeatOperatorWorker(workerToken, 0)

    const lease = await claimOperatorPublishTask(task.id, workerToken)

    let renewWarningShown = false
    const renewInterval = setInterval(() => {
      void renewOperatorPublishTask(lease)
        .then((renewed) => {
          // 续租成功后同步新版本号，否则后续续租会因 lease_version 不匹配返回 409
          if (renewed?.leaseVersion) lease.leaseVersion = renewed.leaseVersion
          if (renewed?.expiresAt) lease.expiresAt = renewed.expiresAt
        })
        .catch((error: unknown) => {
          if (renewWarningShown) return
          renewWarningShown = true
          addToast('warning', getApiErrorMessage(error, `任务 #${task.id} 租约续期失败`))
        })
    }, RENEW_INTERVAL_MS)

    try {
      const startedAt = Date.now()

      if (!lease.taskSnapshotJson || !lease.credentialPayload) {
        throw new Error('服务端未返回任务快照或授权凭据')
      }

      let snapshot: {
        taskId?: number
        enterpriseId?: number
        articleId?: number
        article?: {
          title?: string
          summary?: string
          contentMarkdown?: string
          contentHtml?: string
          coverImageUrl?: string
        }
        platform?: {
          code?: string
          name?: string
          driverType?: number
          loginUrl?: string
        }
        account?: {
          id?: number | string
          name?: string
          externalId?: string
        }
      }
      try {
        snapshot = JSON.parse(lease.taskSnapshotJson)
      } catch {
        throw new Error('任务快照格式无效')
      }

      const platform = snapshot.platform ?? {}
      const article = snapshot.article ?? {}
      const account = snapshot.account ?? {}

      const effectiveContentHtml =
        article.contentHtml?.trim() || renderMarkdownToHTML(article.contentMarkdown || '')

      // eslint-disable-next-line no-console
      console.log('[OperatorPublish] task snapshot article', {
        title: article.title,
        summaryLength: article.summary?.length ?? 0,
        contentHtmlLength: article.contentHtml?.length ?? 0,
        effectiveContentHtmlLength: effectiveContentHtml.length,
        contentMarkdownLength: article.contentMarkdown?.length ?? 0,
        coverImageUrl: article.coverImageUrl,
      })

      const platformName =
        getPlatformDriverId(Number(platform.driverType), 'media') ?? platform.code ?? 'unknown'
      if (platformName === 'unknown') {
        throw new Error(`不支持的发布平台驱动: ${platform.code ?? 'unknown'}`)
      }

      const encryptedSecret = decodeCredentialPayload(lease.credentialPayload)
      if (!encryptedSecret) {
        throw new Error('授权凭据解码失败')
      }

      const targets = [
        {
          platformName,
          encryptedSecret,
          accountId: account.externalId ?? String(account.id ?? ''),
          accountName: account.name ?? platform.name ?? platformName,
          loginUrl: platform.loginUrl,
        },
      ]

      const jobId = `${task.id}:${crypto.randomUUID()}`
      const result: PublishJobResult = await api.run({
        jobId,
        taskId: task.id,
        enterpriseId: task.enterpriseId,
        articleId: snapshot.articleId ?? task.articleId,
        article: {
          title: article.title ?? task.articleTitle ?? '',
          content: effectiveContentHtml || article.contentMarkdown || article.summary || '',
          summary: article.summary ?? '',
          cover: article.coverImageUrl ?? '',
          tags: [],
        },
        targets,
      })

      const failedCount = result.results.filter((item) => item.status === 'failed').length
      const skippedCount = result.results.filter((item) => item.status === 'skipped').length
      const allFailed =
        failedCount === result.results.length && result.results.length > 0
      const allSkipped = skippedCount === result.results.length && result.results.length > 0
      const successfulResult = result.results.find((item) => item.status === 'success')

      await reportOperatorPublishResult({
        lease,
        idempotencyKey: jobId,
        status: allFailed || allSkipped ? 'failed' : 'succeeded',
        result: {
          jobId: result.jobId,
          taskId: result.taskId,
          enterpriseId: result.enterpriseId,
          articleId: result.articleId,
          publishedUrl: successfulResult?.publishedUrl ?? '',
          platformArticleId: successfulResult?.platformArticleId ?? '',
          results: result.results,
        },
        evidence: {
          durationMs: Date.now() - startedAt,
          targetCount: result.results.length,
          failedCount,
          skippedCount,
        },
        errorMessage:
          failedCount > 0
            ? result.results.find((item) => item.status === 'failed')?.errorMsg
            : skippedCount > 0
              ? result.results.find((item) => item.status === 'skipped')?.errorMsg
              : undefined,
        durationMs: Date.now() - startedAt,
      })
    } catch (error) {
      await releaseOperatorPublishTask(lease, 'error').catch((releaseError: unknown) => {
        addToast(
          'warning',
          getApiErrorMessage(releaseError, `任务 #${task.id} 租约释放失败，请等待租约自动过期`),
        )
      })
      throw error
    } finally {
      clearInterval(renewInterval)
    }
  }

  const handlePublishAll = async () => {
    setPublishing(true)
    try {
      const runnable = tasks.filter((task) => task.status === 'pending' || task.status === 'failed')
      if (runnable.length === 0) {
        addToast('warning', '没有可执行的发布任务')
        return
      }
      for (const task of runnable) await runTask(task)
      addToast('success', `已完成 ${runnable.length} 个发布任务`)
    } catch (error) {
      addToast('error', getApiErrorMessage(error, '启动发布任务失败'))
    } finally {
      setPublishing(false)
    }
  }

  const handleRetry = async (taskId: number) => {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    try {
      await runTask(task)
      addToast('success', `任务 #${taskId} 已重新执行`)
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : '任务重试失败')
    } finally {
      await load()
    }
  }

  const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'publishing')
  const failed = tasks.filter((t) => t.status === 'failed')

  const columns = [
    {
      key: 'article',
      title: '文章',
      render: (t: PublishTask) => (
        <span className="text-sm text-app-text truncate max-w-xs block">
          {t.articleTitle || `文章 #${t.articleId}`}
        </span>
      ),
    },
    {
      key: 'platform',
      title: '平台',
      render: (t: PublishTask) => (
        <span className="text-sm text-app-text-muted">{t.platformLabel || t.platformName}</span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      render: (t: PublishTask) => <TaskStatusBadge status={t.status} />,
    },
    {
      key: 'retry',
      title: '重试次数',
      render: (t: PublishTask) => (
        <span className="text-sm text-app-text-dim">{t.retryCount}</span>
      ),
    },
    {
      key: 'error',
      title: '错误信息',
      render: (t: PublishTask) =>
        t.errorMsg ? (
          <div className="flex items-center gap-1 text-xs text-app-danger max-w-48 truncate">
            <AlertCircle size={12} />
            {t.errorMsg}
          </div>
        ) : (
          <span className="text-app-text-dim text-xs">—</span>
        ),
    },
    {
      key: 'actions',
      title: '操作',
      render: (t: PublishTask) =>
        t.status === 'failed' ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<RefreshCw size={12} />}
            onClick={() => handleRetry(t.id)}
          >
            重试
          </Button>
        ) : null,
    },
  ]

  return (
    <PageShell>
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => load()}>
              刷新
            </Button>
            <Button variant="primary" size="sm" loading={publishing} icon={<Play size={14} />} onClick={handlePublishAll}>
              发布全部待发
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="进行中" value={pending.length} tone="info" icon={<AlertCircle size={18} className="text-app-info" />} />
        <StatCard label="已完成" value={tasks.filter((t) => t.status === 'success').length} tone="success" icon={<Play size={18} className="text-app-success" />} />
        <StatCard label="失败" value={failed.length} tone="warning" icon={<AlertCircle size={18} className="text-app-warning" />} />
      </div>

      <SectionCard title="所有任务">
        {loading ? (
          <PageLoader />
        ) : tasks.length === 0 ? (
          <Empty
            title="暂无发布任务"
            description={'点击「发布全部待发」按钮开始批量发布'}
          />
        ) : (
          <Table columns={columns} data={tasks} rowKey="id" />
        )}
      </SectionCard>
    </PageShell>
  )
}
