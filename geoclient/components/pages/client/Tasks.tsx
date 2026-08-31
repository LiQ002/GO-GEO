'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Play, RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'
import PageShell from '@/components/ui/PageShell'
import Section, { SectionCard } from '@/components/ui/Section'
import ProgressBar from '@/components/ui/ProgressBar'
import Tag from '@/components/ui/Tag'
import { ArticleStatusBadge, TaskStatusBadge } from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import Empty from '@/components/ui/Empty'
import { getClientArticles, getClientPublishTasks, startClientPublishTask } from '@/lib/api'
import type { Article, PublishTask } from '@/types/app'
import { useAppStore } from '@/lib/store/useAppStore'

export default function ClientTasks() {
  const [articles, setArticles] = useState<Article[]>([])
  const [tasks, setTasks] = useState<PublishTask[]>([])
  const [taskEnabled, setTaskEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const addToast = useAppStore((state) => state.addToast)

  const loadData = useCallback(() => {
    return Promise.all([
      getClientArticles({ pageSize: 50 }),
      getClientPublishTasks(),
    ]).then(([artRes, taskList]) => {
      setArticles(artRes.items)
      setTasks(taskList)
    })
  }, [])

  useEffect(() => {
    loadData().finally(() => setLoading(false))
    const interval = setInterval(() => {
      if (taskEnabled) loadData()
    }, 5000)
    return () => clearInterval(interval)
  }, [loadData, taskEnabled])

  const handleToggleTask = (next: boolean) => {
    setTaskEnabled(next)
    addToast('info', next ? '自动发布任务已开启' : '自动发布任务已暂停')
  }

  const handlePublishNow = async () => {
    setPublishing(true)
    try {
      const pendingTaskIds = tasks
        .filter((task) => task.status === 'pending' || task.status === 'failed')
        .map((task) => task.id)
      if (pendingTaskIds.length === 0) {
        addToast('warning', '没有可启动的发布任务')
        return
      }
      await Promise.all(pendingTaskIds.map(startClientPublishTask))
      addToast('success', `已启动 ${pendingTaskIds.length} 个发布任务`)
      await loadData()
    } catch {
      addToast('error', '启动发布失败')
    } finally {
      setPublishing(false)
    }
  }

  const handleRetry = async (taskId: number) => {
    try {
      await startClientPublishTask(taskId)
      addToast('success', '重试任务已提交')
      await loadData()
    } catch {
      addToast('error', '重试失败')
    }
  }

  const pendingArticles = articles.filter((a) => a.status === 'pending_review' || a.status === 'failed')
  const activeTasks = tasks.filter((t) => t.status === 'publishing' || t.status === 'pending')

  const articleColumns = [
    {
      key: 'title',
      title: '文章',
      render: (a: Article) => (
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-app-text-dim flex-shrink-0" />
          <span className="text-sm text-app-text truncate">{a.title}</span>
        </div>
      ),
    },
    {
      key: 'tags',
      title: '标签',
      render: (a: Article) => (
        <div className="flex gap-1 flex-wrap">
          {(a.tags || []).slice(0, 2).map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      title: '状态',
      render: (a: Article) => <ArticleStatusBadge status={a.status} />,
    },
  ]

  const taskColumns = [
    {
      key: 'article',
      title: '文章',
      render: (t: PublishTask) => (
        <span className="text-sm text-app-text truncate block max-w-[12rem]">
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
      key: 'action',
      title: '',
      render: (t: PublishTask) =>
        t.status === 'failed' ? (
          <Button size="sm" variant="secondary" icon={<RefreshCw size={12} />} onClick={() => handleRetry(t.id)}>
            重试
          </Button>
        ) : null,
    },
  ]

  if (loading) return <PageLoader />

  return (
    <PageShell>
      <Section
        title="自动发布任务"
        description="开启后将自动检查并发布待发布的文章"
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => loadData()}>
              刷新
            </Button>
            <Button variant="primary" size="sm" loading={publishing} icon={<Play size={14} />} onClick={handlePublishNow}>
              立即发布
            </Button>
          </div>
        }
        className="bg-app-surface"
      >
        <Switch
          checked={taskEnabled}
          onChange={handleToggleTask}
          label={taskEnabled ? '任务运行中' : '任务已暂停'}
          description={taskEnabled ? '每 5 秒自动刷新任务状态' : '开启后自动检查待发文章'}
        />

        {activeTasks.length > 0 && (
          <div className="mt-5 pt-5 border-t border-app-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-app-text-muted">正在发布中...</span>
              <span className="text-xs text-app-text-dim tabular-nums">{activeTasks.length} 个任务</span>
            </div>
            <ProgressBar value={60} animated />
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="待发布文章" count={pendingArticles.length}>
          {pendingArticles.length === 0 ? (
            <Empty title="没有待发布文章" description="所有文章都已发布完毕" />
          ) : (
            <Table columns={articleColumns} data={pendingArticles} rowKey="id" />
          )}
        </SectionCard>

        <SectionCard title="发布任务" count={tasks.length}>
          {tasks.length === 0 ? (
            <Empty title="没有发布任务" description={'点击「立即发布」开始发布文章'} />
          ) : (
            <Table columns={taskColumns} data={tasks} rowKey="id" />
          )}
        </SectionCard>
      </div>
    </PageShell>
  )
}
