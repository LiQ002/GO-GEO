'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  BarChart3,
  CheckCircle2,
  FileText,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { StatCard } from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import PageShell from '@/components/ui/PageShell'
import ProgressBar from '@/components/ui/ProgressBar'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { getStats } from '@/lib/api'
import { getPlatformColor } from '@/lib/platform-manifest'
import type { Stats } from '@/types/app'
import { useAppStore } from '@/lib/store/useAppStore'

export default function OperatorDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const addToast = useAppStore((s) => s.addToast)

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => addToast('error', '获取统计数据失败，请检查服务连接'))
      .finally(() => setLoading(false))
  }, [addToast])

  if (loading) return <PageLoader />

  const successRate = stats ? Math.round(stats.successRate * 100) : 0
  const platformMax = Math.max(...(stats?.platformStats.map((p) => p.count) ?? [1]))

  return (
    <PageShell>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="注册用户"
          value={stats?.totalUsers ?? 0}
          change="平台运营用户总数"
          tone="accent"
          icon={<Users size={18} className="text-app-accent" />}
        />
        <StatCard
          label="文章总数"
          value={stats?.totalArticles ?? 0}
          change="待发布 + 已发布"
          tone="info"
          icon={<FileText size={18} className="text-app-info" />}
        />
        <StatCard
          label="今日发布"
          value={stats?.publishedToday ?? 0}
          change={`累计 ${stats?.totalPublished ?? 0} 篇`}
          changeType="up"
          tone="warning"
          icon={<Zap size={18} className="text-app-warning" />}
        />
        <StatCard
          label="成功率"
          value={`${successRate}%`}
          change={successRate >= 90 ? '发布质量优秀' : '存在失败任务'}
          changeType={successRate >= 90 ? 'up' : 'down'}
          tone="success"
          icon={<TrendingUp size={18} className="text-app-success" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Section title="各平台发布分布" icon={<BarChart3 size={16} />}>
          <div className="space-y-4">
            {(stats?.platformStats ?? []).map((ps) => {
              const pct = platformMax > 0 ? (ps.count / platformMax) * 100 : 0
              return (
                <div key={ps.platform} className="min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <span className="text-sm text-app-text-muted flex-shrink-0 min-w-[5rem] truncate">
                      {ps.label}
                    </span>
                    <div className="flex items-center gap-3 flex-shrink-0 text-sm">
                      <span className="text-app-text-dim">
                        成功率 {Math.round(ps.successRate * 100)}%
                      </span>
                      <span className="font-medium text-app-text tabular-nums">{ps.count}</span>
                    </div>
                  </div>
                  <ProgressBar value={pct} color={getPlatformColor(ps.platform)} />
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="最近活动" icon={<Activity size={16} />}>
          {(stats?.recentActivity ?? []).length === 0 ? (
            <p className="text-sm text-app-text-dim text-center py-8">暂无活动记录</p>
          ) : (
            <div className="space-y-2">
              {(stats?.recentActivity ?? []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-app-elevated border border-app-border/60"
                >
                  <span className="mt-0.5 flex-shrink-0">
                    {item.type === 'success' ? (
                      <CheckCircle2 size={15} className="text-app-success" />
                    ) : item.type === 'failed' ? (
                      <XCircle size={15} className="text-app-danger" />
                    ) : (
                      <Zap size={15} className="text-app-info" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-app-text-muted leading-relaxed">{item.message}</p>
                    <p className="text-xs text-app-text-dim mt-0.5">
                      {new Date(item.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </PageShell>
  )
}
