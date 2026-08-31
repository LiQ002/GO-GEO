'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Eye, Search, X } from 'lucide-react'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/Section'
import Tag from '@/components/ui/Tag'
import Input, { Select } from '@/components/ui/Input'
import Table, { Pagination } from '@/components/ui/Table'
import { ArticleStatusBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import Empty from '@/components/ui/Empty'
import { changeOperatorArticleStatus, getBaseURL, getOperatorArticles } from '@/lib/api'
import type { Article, ArticleStatus, PublishedPlatform } from '@/types/app'
import { getPlatformManifest } from '@/lib/platform-manifest'
import { useAppStore } from '@/lib/store/useAppStore'

const PLATFORMS = [
  { value: '', label: '全部平台' },
  { value: 'wechat', label: '微信公众号' },
  { value: 'zhihu', label: '知乎' },
  { value: 'toutiao', label: '头条号' },
  { value: 'weibo', label: '微博' },
  { value: 'baijiahao', label: '百家号' },
  { value: 'xiaohongshu', label: '小红书' },
]

const STATUSES = [
  { value: '', label: '全部状态' },
  { value: 'pending_review', label: '待审核' },
  { value: 'normal', label: '待发布' },
  { value: 'disabled', label: '已禁用' },
  { value: 'archived', label: '已归档' },
]

/**
 * 后端文章状态只有 pending_review/normal/disabled/archived，不再有 published。
 * 发布成功后后端仅写入 published_at，状态保持 normal。前端依据 publishedAt 判断
 * 是否已发布，将 normal + publishedAt 的组合显示为 "已发布"。
 */
function effectiveStatus(a: Article): ArticleStatus {
  if (a.status === 'normal' && a.publishedAt) return 'published'
  return a.status
}

/** Resolve an icon URL to a fully-qualified URL if it's relative. */
function resolveIconUrl(iconUrl?: string): string | undefined {
  if (!iconUrl) return undefined
  if (/^https?:\/\//i.test(iconUrl)) return iconUrl
  // Relative path — prepend the API base URL.
  const base = getBaseURL().replace(/\/+$/, '')
  return `${base}${iconUrl.startsWith('/') ? '' : '/'}${iconUrl}`
}

function PlatformIcon({ platform }: { platform: PublishedPlatform }) {
  const iconUrl = resolveIconUrl(platform.iconUrl)
  const manifest = platform.platformId
    ? getPlatformManifest(platform.platformId, 'media')
    : undefined
  const label = manifest?.label ?? platform.platformLabel

  // 1. If we have an uploaded icon URL, show it as an <img>.
  if (iconUrl) {
    return (
      <Image
        src={iconUrl}
        width={20}
        height={20}
        unoptimized
        className="w-5 h-5 rounded-full object-cover flex-shrink-0"
        alt={label}
        title={label}
      />
    )
  }

  // 2. Fall back to manifest text icon with brand color.
  if (manifest) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold flex-shrink-0"
        style={{ backgroundColor: manifest.iconStyle.bg, color: manifest.iconStyle.text }}
        title={label}
      >
        {manifest.icon}
      </span>
    )
  }

  // 3. Last resort — first character of the channel name.
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold bg-app-elevated text-app-text-muted flex-shrink-0"
      title={label}
    >
      {platform.platformLabel.charAt(0)}
    </span>
  )
}

function ArticleTitleCell({ article }: { article: Article }) {
  const platforms = article.publishedPlatforms ?? []
  const hasPlatforms = platforms.length > 0

  return (
    <div className="group relative max-w-xs">
      <div className="min-w-0">
        <div className="text-sm font-medium text-app-text truncate">{article.title}</div>
        {article.summary && (
          <div className="text-xs text-app-text-dim truncate">{article.summary}</div>
        )}
      </div>
      {hasPlatforms && (
        <div className="absolute left-0 top-full mt-1 z-20 hidden group-hover:flex items-center gap-1.5 bg-app-surface border border-app-border rounded-lg shadow-lg px-3 py-2">
          <span className="text-xs text-app-text-dim mr-1 whitespace-nowrap">已发布到</span>
          {platforms.map((p, i) => (
            <PlatformIcon key={`${p.platformId}-${i}`} platform={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatusCell({ article }: { article: Article }) {
  const platforms = article.publishedPlatforms ?? []
  const hasPlatforms = platforms.length > 0

  return (
    <div className="group relative inline-block">
      <ArticleStatusBadge status={effectiveStatus(article)} />
      {hasPlatforms && (
        <div className="absolute left-0 top-full mt-1 z-20 hidden group-hover:flex items-center gap-1.5 bg-app-surface border border-app-border rounded-lg shadow-lg px-3 py-2 whitespace-nowrap">
          <span className="text-xs text-app-text-dim mr-1">已发布到</span>
          {platforms.map((p, i) => (
            <PlatformIcon key={`${p.platformId}-${i}`} platform={p} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OperatorArticles() {
  const [articles, setArticles] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailArticle, setDetailArticle] = useState<Article | null>(null)
  const [reviewReason, setReviewReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const addToast = useAppStore((s) => s.addToast)

  const load = useCallback((p: number) => {
    setLoading(true)
    getOperatorArticles({
      page: p,
      pageSize: 20,
      search: search || undefined,
      status: statusFilter || undefined,
    })
      .then((res) => {
        setArticles(res.items)
        setTotal(res.total)
      })
      .catch(() => addToast('error', '获取文章列表失败'))
      .finally(() => setLoading(false))
  }, [addToast, search, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => load(page), 0)
    return () => window.clearTimeout(timer)
  }, [load, page, platformFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    load(1)
  }

  const handleStatusChange = async (
    article: Article,
    action: 'approve' | 'disable' | 'review',
  ) => {
    const reason = reviewReason.trim() || defaultReason(action)
    if (!reason) {
      addToast('error', '请填写操作原因')
      return
    }
    if (!article.version) {
      addToast('error', '文章版本信息缺失，无法操作')
      return
    }
    setActionLoading(true)
    try {
      await changeOperatorArticleStatus(article.id, article.version, action, reason)
      addToast('success', '状态更新成功')
      setDetailArticle(null)
      setReviewReason('')
      load(page)
    } catch {
      addToast('error', '状态更新失败，请重试')
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    {
      key: 'title',
      title: '文章',
      render: (a: Article) => <ArticleTitleCell article={a} />,
    },
    {
      key: 'tags',
      title: '标签',
      render: (a: Article) => (
        <div className="flex flex-wrap gap-1">
          {(a.tags || []).slice(0, 2).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      title: '状态',
      render: (a: Article) => <StatusCell article={a} />,
    },
    {
      key: 'createdAt',
      title: '创建时间',
      render: (a: Article) => (
        <span className="text-xs text-app-text-dim">
          {new Date(a.createdAt).toLocaleDateString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      render: (a: Article) => (
        <button
          onClick={() => { setDetailArticle(a); setReviewReason('') }}
          className="inline-flex items-center gap-1 text-xs text-app-accent hover:underline"
        >
          <Eye size={12} />
          审核详情
        </button>
      ),
    },
  ]

  return (
    <PageShell>
      <PageHeader
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Select
              options={STATUSES}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="w-32 text-xs"
            />
            <Select
              options={PLATFORMS}
              value={platformFilter}
              onChange={(e) => { setPlatformFilter(e.target.value); setPage(1) }}
              className="w-36 text-xs"
            />
            <form onSubmit={handleSearch}>
              <Input
                placeholder="搜索文章标题..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prefix={<Search size={14} />}
                className="w-52"
              />
            </form>
          </div>
        }
      />

      <SectionCard title="文章列表" count={total}>
        {loading ? (
          <PageLoader />
        ) : articles.length === 0 ? (
          <Empty
            title="暂无文章"
            description="当前筛选条件下没有文章"
            action={
              <button
                onClick={() => { setStatusFilter(''); setPlatformFilter(''); setSearch('') }}
                className="text-xs text-app-accent hover:underline"
              >
                清除筛选条件
              </button>
            }
          />
        ) : (
          <>
            <Table columns={columns} data={articles} rowKey="id" />
            <Pagination
              page={page}
              pageSize={20}
              total={total}
              onChange={(p) => setPage(p)}
            />
          </>
        )}
      </SectionCard>

      {detailArticle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailArticle(null)}
        >
          <div
            className="bg-app-surface rounded-2xl border border-app-border shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-app-border px-6 py-4">
              <h3 className="text-lg font-semibold text-app-text truncate">
                {detailArticle.title}
              </h3>
              <button
                onClick={() => setDetailArticle(null)}
                className="text-app-text-dim hover:text-app-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex items-center gap-3 px-6 py-3 border-b border-app-border">
              <ArticleStatusBadge status={effectiveStatus(detailArticle)} />
              {detailArticle.userName && (
                <span className="text-xs text-app-text-dim">
                  作者：{detailArticle.userName}
                </span>
              )}
              <span className="text-xs text-app-text-dim">
                {new Date(detailArticle.createdAt).toLocaleString('zh-CN')}
              </span>
              {detailArticle.publishedPlatforms && detailArticle.publishedPlatforms.length > 0 && (
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-xs text-app-text-dim">已发布到</span>
                  {detailArticle.publishedPlatforms.map((p, i) => (
                    <PlatformIcon key={`${p.platformId}-${i}`} platform={p} />
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {detailArticle.cover && (
                <Image
                  src={detailArticle.cover}
                  width={800}
                  height={400}
                  unoptimized
                  className="w-full h-48 object-cover rounded-xl mb-4"
                  alt=""
                />
              )}
              {detailArticle.content ? (
                <div
                  className="prose prose-sm max-w-none text-app-text"
                  dangerouslySetInnerHTML={{ __html: detailArticle.content }}
                />
              ) : (
                <p className="text-sm text-app-text-dim">暂无内容</p>
              )}
            </div>

            <div className="border-t border-app-border px-6 py-4 space-y-3">
              <Input
                placeholder="操作原因（必填，例如：内容确认无误，审核通过）"
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                className="w-full"
              />
              <div className="flex items-center gap-2">
                {detailArticle.status === 'pending_review' && (
                  <>
                    <button
                      onClick={() => handleStatusChange(detailArticle, 'approve')}
                      disabled={actionLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-app-success rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                      审核通过
                    </button>
                    <button
                      onClick={() => handleStatusChange(detailArticle, 'disable')}
                      disabled={actionLoading}
                      className="px-4 py-2 text-sm font-medium text-app-danger border border-app-danger/20 bg-app-danger/10 rounded-lg hover:bg-app-danger/20 disabled:opacity-50"
                    >
                      禁用
                    </button>
                  </>
                )}
                {detailArticle.status === 'normal' && (
                  <button
                    onClick={() => handleStatusChange(detailArticle, 'disable')}
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm font-medium text-app-danger border border-app-danger/20 bg-app-danger/10 rounded-lg hover:bg-app-danger/20 disabled:opacity-50"
                  >
                    禁用
                  </button>
                )}
                {detailArticle.status === 'disabled' && (
                  <button
                    onClick={() => handleStatusChange(detailArticle, 'approve')}
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-app-accent rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    恢复正常
                  </button>
                )}
                <button
                  onClick={() => setDetailArticle(null)}
                  className="ml-auto px-4 py-2 text-sm text-app-text-muted hover:text-app-text"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}

function defaultReason(action: 'approve' | 'disable' | 'review'): string {
  switch (action) {
    case 'approve':
      return '运营审核通过'
    case 'disable':
      return '运营禁用文章'
    case 'review':
      return '运营重新审核'
  }
}
