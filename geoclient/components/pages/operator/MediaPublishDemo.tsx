'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, CheckCircle2, LogIn, Save, X } from 'lucide-react'
import Section from '@/components/ui/Section'
import Button from '@/components/ui/Button'
import {
  getMediaDemoPlatform,
  MEDIA_DEMO_ARTICLE,
  MEDIA_DEMO_PLATFORMS,
  type MediaDemoPlatformId,
} from '@/lib/publish-demos/media'
import {
  closeMediaDemoSession,
  openMediaDemoLogin,
  publishMediaDemo,
} from '@/lib/services/mediaPublishDemo'
import { useAppStore } from '@/lib/store/useAppStore'

type DemoStatus = 'idle' | 'waiting-login' | 'publishing' | 'saved' | 'error'

const articleTextPreview = MEDIA_DEMO_ARTICLE.content
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

function errorMessage(error: unknown, platformLabel: string) {
  return error instanceof Error ? error.message : `${platformLabel}示例执行失败`
}

function initialMessage(platformLabel: string) {
  return `先打开${platformLabel}登录窗口，并在平台页面中完成登录。`
}

function actionLabel(completion: 'draft' | 'autosave' | 'filled') {
  if (completion === 'autosave') return '2. 填充并等待自动保存'
  if (completion === 'filled') return '2. 填充并停留在编辑页'
  return '2. 填充并保存草稿'
}

function successMessage(platformLabel: string, completion: 'draft' | 'autosave' | 'filled') {
  if (completion === 'autosave') {
    return `模拟文章已填充，并检测到${platformLabel}自动保存完成；示例不会执行正式发布。`
  }
  if (completion === 'filled') {
    return `模拟文章已填充并停留在${platformLabel}编辑页；为避免误发，示例不会点击下一步或发布。`
  }
  return `模拟文章已填充并保存到${platformLabel}草稿；示例不会执行正式发布。`
}

export default function MediaPublishDemo() {
  const [platformId, setPlatformId] = useState<MediaDemoPlatformId>('wechat')
  const [sessionId, setSessionId] = useState<string>()
  const [status, setStatus] = useState<DemoStatus>('idle')
  const [message, setMessage] = useState(initialMessage(getMediaDemoPlatform('wechat').label))
  const [opening, setOpening] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [closing, setClosing] = useState(false)
  const sessionRef = useRef<string | undefined>(undefined)
  const addToast = useAppStore((state) => state.addToast)
  const platform = getMediaDemoPlatform(platformId)
  const busy = opening || publishing || closing

  useEffect(() => {
    sessionRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    return () => {
      void closeMediaDemoSession(sessionRef.current)
    }
  }, [])

  const handleSelectPlatform = useCallback(
    async (nextPlatformId: MediaDemoPlatformId) => {
      if (nextPlatformId === platformId || busy) return
      setClosing(true)
      try {
        await closeMediaDemoSession(sessionRef.current)
        sessionRef.current = undefined
        setSessionId(undefined)
        setPlatformId(nextPlatformId)
        setStatus('idle')
        setMessage(initialMessage(getMediaDemoPlatform(nextPlatformId).label))
      } catch (error) {
        const text = errorMessage(error, platform.label)
        setStatus('error')
        setMessage(text)
        addToast('error', text)
      } finally {
        setClosing(false)
      }
    },
    [addToast, busy, platform.label, platformId],
  )

  const handleOpenLogin = useCallback(async () => {
    setOpening(true)
    try {
      const result = await openMediaDemoLogin(platformId, sessionId)
      sessionRef.current = result.sessionId
      setSessionId(result.sessionId)
      setStatus('waiting-login')
      setMessage(`登录窗口已打开。完成${platform.label}登录后，点击“${actionLabel(platform.completion).replace('2. ', '')}”。`)
      addToast('success', `${platform.label}登录窗口已打开`)
    } catch (error) {
      const text = errorMessage(error, platform.label)
      setStatus('error')
      setMessage(text)
      addToast('error', text)
    } finally {
      setOpening(false)
    }
  }, [addToast, platform, platformId, sessionId])

  const handlePublishDemo = useCallback(async () => {
    if (!sessionId) {
      addToast('warning', `请先打开${platform.label}登录窗口`)
      return
    }

    setPublishing(true)
    setStatus('publishing')
    setMessage(`正在验证${platform.label}登录状态、打开编辑器并用键盘填充模拟文章……`)
    try {
      const result = await publishMediaDemo(platformId, sessionId)
      sessionRef.current = result.sessionId
      setSessionId(result.sessionId)
      setStatus('saved')
      const text = successMessage(platform.label, platform.completion)
      setMessage(text)
      addToast('success', `${platform.label}文章模拟完成`)
    } catch (error) {
      const text = errorMessage(error, platform.label)
      setStatus('error')
      setMessage(text)
      addToast('error', text)
    } finally {
      setPublishing(false)
    }
  }, [addToast, platform, platformId, sessionId])

  const handleClose = useCallback(async () => {
    if (!sessionId) return
    setClosing(true)
    try {
      await closeMediaDemoSession(sessionId)
      sessionRef.current = undefined
      setSessionId(undefined)
      setStatus('idle')
      setMessage(`${platform.label}示例浏览器已关闭，可以重新开始演示。`)
    } catch (error) {
      const text = errorMessage(error, platform.label)
      setStatus('error')
      setMessage(text)
      addToast('error', text)
    } finally {
      setClosing(false)
    }
  }, [addToast, platform.label, sessionId])

  const statusClass =
    status === 'saved'
      ? 'border-app-success/30 bg-app-success-subtle text-app-success'
      : status === 'error'
        ? 'border-app-danger/30 bg-app-danger-subtle text-app-danger'
        : 'border-app-info/30 bg-app-info-subtle text-app-text-muted'

  return (
    <Section
      title="多平台文章自动发布示例"
      description="选择内容平台，演示 Puppeteer 登录态复用、真实键盘输入和安全草稿保存；不会触发正式发布。"
      icon={<BookOpen size={17} />}
    >
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" role="list">
        {MEDIA_DEMO_PLATFORMS.map((item) => {
          const selected = item.id === platformId
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              disabled={busy}
              onClick={() => void handleSelectPlatform(item.id as MediaDemoPlatformId)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? 'border-app-accent bg-app-accent-subtle text-app-accent'
                  : 'border-app-border bg-app-surface text-app-text-muted hover:border-app-border-strong hover:bg-app-hover'
              }`}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-semibold"
                style={{ backgroundColor: item.iconStyle.bg, color: item.iconStyle.text }}
              >
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="min-w-0 space-y-4">
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ['1', '平台登录', `Puppeteer 打开${platform.label}`],
              ['2', '键盘填充', '点击字段后输入标题、摘要和正文'],
              [
                '3',
                platform.completion === 'filled' ? '停留编辑页' : '安全存草稿',
                platform.completion === 'autosave'
                  ? '等待平台自动保存完成'
                  : platform.completion === 'filled'
                    ? '不点击下一步或发布'
                    : '只点击明确的草稿按钮',
              ],
            ].map(([step, title, description]) => (
              <li key={step} className="rounded-xl border border-app-border bg-app-surface p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-app-accent-subtle text-xs font-semibold text-app-accent">
                    {step}
                  </span>
                  <span className="text-sm font-medium text-app-text">{title}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-app-text-dim">{description}</p>
              </li>
            ))}
          </ol>

          <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${statusClass}`}>
            <div className="flex items-start gap-2">
              {status === 'saved' && <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
              <span>{message}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<LogIn size={14} />}
              loading={opening}
              disabled={publishing || closing}
              onClick={() => void handleOpenLogin()}
            >
              {sessionId ? `重新打开${platform.label}` : `1. 打开${platform.label}登录`}
            </Button>
            <Button
              variant="primary"
              icon={<Save size={14} />}
              loading={publishing}
              disabled={!sessionId || opening || closing}
              onClick={() => void handlePublishDemo()}
            >
              {actionLabel(platform.completion)}
            </Button>
            {sessionId && (
              <Button
                variant="ghost"
                icon={<X size={14} />}
                loading={closing}
                disabled={opening || publishing}
                onClick={() => void handleClose()}
              >
                关闭示例浏览器
              </Button>
            )}
          </div>
        </div>

        <article className="min-w-0 rounded-xl border border-app-border bg-app-elevated p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-app-accent">本地模拟文章</span>
            <span
              className="rounded-full px-2 py-1 text-[11px]"
              style={{ backgroundColor: platform.iconStyle.bg, color: platform.iconStyle.text }}
            >
              {platform.label}
            </span>
          </div>
          <h4 className="mt-3 text-sm font-semibold leading-relaxed text-app-text">
            {MEDIA_DEMO_ARTICLE.title}
          </h4>
          <p className="mt-2 text-xs text-app-text-dim">作者：{MEDIA_DEMO_ARTICLE.author}</p>
          <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-app-text-muted">
            {articleTextPreview}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {MEDIA_DEMO_ARTICLE.tags?.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-app-border bg-app-surface px-2 py-1 text-[11px] text-app-text-dim"
              >
                {tag}
              </span>
            ))}
          </div>
        </article>
      </div>
    </Section>
  )
}
