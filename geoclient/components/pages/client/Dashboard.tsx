'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, FileText, Search, TrendingUp, XCircle, Zap } from 'lucide-react'
import { StatCard } from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import PageShell from '@/components/ui/PageShell'
import AlertBanner from '@/components/ui/AlertBanner'
import { PlatformProgressItem } from '@/components/ui/ProgressBar'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { TaskStatusBadge } from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import { getClientPublishTasks, getUserStats } from '@/lib/api'
import { getPlatformColor } from '@/lib/platform-manifest'
import type { PublishTask, UserStats } from '@/types/app'
import { useAppStore } from '@/lib/store/useAppStore'

export default function ClientDashboard() {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [recentTasks, setRecentTasks] = useState<PublishTask[]>([])
  const [loading, setLoading] = useState(true)
  const currentUser = useAppStore((state) => state.currentUser)
  const addToast = useAppStore((state) => state.addToast)

  useEffect(() => {
    Promise.all([getUserStats(), getClientPublishTasks()])
      .then(([s, tasks]) => {
        setStats(s)
        setRecentTasks(tasks.slice(0, 8))
      })
      .catch(() => addToast('error', '加载数据失败'))
      .finally(() => setLoading(false))
  }, [addToast])

  if (loading) return <PageLoader />

  const platformMax = Math.max(...(stats?.platformStats.map((p) => p.count) ?? [1]))

  return (
    <PageShell>
      <div className="space-y-4 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-app-accent font-medium">
              Hello {currentUser?.name || ''}, welcome back!
            </p>
            <h2 className="text-2xl font-semibold text-app-text mt-1 tracking-tight">
              我的概览
            </h2>
          </div>
          <div className="w-[280px] hidden md:block">
            <Input placeholder="Search..." prefix={<Search size={16} />} />
          </div>
        </div>

        <AlertBanner
          title="今日状态"
          description={
            stats?.pendingCount
              ? `您有 ${stats.pendingCount} 篇文章等待发布`
              : '您的文章都已发布完毕，干得漂亮！'
          }
        />

        {/* Stats cards - 顶部统计卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="我的文章"
            value={stats?.totalArticles ?? 0}
            tone="accent"
            icon={<FileText size={18} className="text-app-accent" />}
          />
          <StatCard
            label="已发布"
            value={stats?.publishedCount ?? 0}
            tone="success"
            icon={<CheckCircle2 size={18} className="text-app-success" />}
          />
          <StatCard
            label="待发布"
            value={stats?.pendingCount ?? 0}
            tone="warning"
            icon={<Zap size={18} className="text-app-warning" />}
          />
          <StatCard
            label="成功率"
            value={`${Math.round((stats?.successRate ?? 0) * 100)}%`}
            tone="info"
            icon={<TrendingUp size={18} className="text-app-info" />}
          />
        </div>

        {/* 左右分布：各平台发布分布 + 最近发布记录 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Section title="统计" description="各平台发布分布">
            {(stats?.platformStats ?? []).length === 0 ? (
              <p className="text-sm text-app-text-dim text-center py-8">还没有平台发布数据</p>
            ) : (
              <div className="space-y-4">
                {(stats?.platformStats ?? []).map((ps) => (
                  <PlatformProgressItem
                    key={ps.platform}
                    label={ps.label}
                    count={ps.count}
                    max={platformMax}
                    suffix=" 篇"
                    color={getPlatformColor(ps.platform)}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="最近发布记录">
            {recentTasks.length === 0 ? (
              <p className="text-sm text-app-text-dim text-center py-8">暂无发布记录</p>
            ) : (
              <div className="space-y-2">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-app-surface border border-app-border shadow-(--shadow-card)"
                  >
                    <span className="flex-shrink-0">
                      {task.status === 'success' ? (
                        <CheckCircle2 size={16} className="text-app-success" />
                      ) : task.status === 'failed' ? (
                        <XCircle size={16} className="text-app-danger" />
                      ) : (
                        <Zap size={16} className="text-app-info" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-app-text truncate">
                        {task.articleTitle || `文章 #${task.articleId}`}
                      </p>
                      <p className="text-xs text-app-text-dim mt-0.5">
                        {task.platformLabel || task.platformName}
                      </p>
                    </div>
                    <TaskStatusBadge status={task.status} />
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </PageShell>
  )
}
