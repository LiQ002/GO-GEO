'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Eye, Play, RefreshCw } from 'lucide-react'
import { StatCard } from '@/components/ui/Card'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/Section'
import Button from '@/components/ui/Button'
import { TaskStatusBadge } from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import Empty from '@/components/ui/Empty'
import {
  claimOperatorGeoTask,
  ensureOperatorWorkerToken,
  getApiErrorMessage,
  getOperatorGeoTasks,
  heartbeatOperatorWorker,
  releaseOperatorPublishTask,
  renewOperatorPublishTask,
  reportOperatorGeoResult,
  retryOperatorGeoTask,
} from '@/lib/api'
import type { OperatorTaskLease } from '@/lib/api'
import { getPlatformDriverId } from '@/lib/platform-manifest'
import { getDeviceId } from '@/lib/device-id'
import type { GeoJobResult } from '@/lib/ipc-contract'
import type { GeoTask } from '@/types/app'
import { useAppStore } from '@/lib/store/useAppStore'

// 服务端租约有效期 5 分钟（300s），续租间隔需远小于租约时长，确保单次续租失败后下次仍在有效期内。
// 心跳续期间隔：30 秒，配合 5 分钟租约时长，确保慢响应平台（如 KIMI 移动端 2-3 分钟）不会过期
const RENEW_INTERVAL_MS = 30_000

function decodeCredentialPayload(payload?: string): string {
  if (!payload) return ''
  try {
    return atob(payload)
  } catch {
    return payload
  }
}

export default function OperatorGeoMonitoring() {
  const [tasks, setTasks] = useState<GeoTask[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const addToast = useAppStore((state) => state.addToast)

  const load = useCallback(() => {
    return getOperatorGeoTasks()
      .then(setTasks)
      .catch(() => addToast('error', '获取 GEO 监测任务失败'))
  }, [addToast])

  useEffect(() => {
    load().finally(() => setLoading(false))
    const interval = setInterval(() => void load(), 5000)
    return () => clearInterval(interval)
  }, [load])

  const runTask = async (task: GeoTask) => {
    const api = window.electronAPI?.geoJobs
    if (!api) throw new Error('Electron GEO 执行器不可用')

    const nodeId = getDeviceId()
    const workerToken = await ensureOperatorWorkerToken(nodeId, ['geo'])
    await heartbeatOperatorWorker(workerToken, 0, ['geo'])

    if (task.status === 'failed') {
      await retryOperatorGeoTask(task)
    }

    const lease = await claimOperatorGeoTask(task.id, workerToken)

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
          addToast('warning', getApiErrorMessage(error, `GEO 任务 #${task.id} 租约续期失败`))
        })
    }, RENEW_INTERVAL_MS)

    try {
      const startedAt = Date.now()

      if (!lease.taskSnapshotJson) {
        throw new Error('服务端未返回 GEO 任务快照')
      }

      let snapshot: {
        taskId?: number
        enterpriseId?: number
        question?: { text?: string }
        site?: { code?: string; name?: string; driverType?: number; entryUrl?: string }
        brand?: { name?: string; officialDomain?: string; aliases?: string[] }
        modelEntry?: string
        locale?: string
        region?: string
        account?: { id?: number | string; name?: string; externalId?: string }
      }
      try {
        snapshot = JSON.parse(lease.taskSnapshotJson)
      } catch {
        throw new Error('GEO 任务快照格式无效')
      }

      const site = snapshot.site ?? {}
      const platformName =
        getPlatformDriverId(Number(site.driverType), 'model') ?? site.code ?? 'unknown'
      if (platformName === 'unknown') {
        throw new Error(`不支持的模型平台驱动: ${site.code ?? 'unknown'}`)
      }

      const encryptedSecret = decodeCredentialPayload(lease.credentialPayload)

      const jobId = `${task.id}:${crypto.randomUUID()}`
      const result: GeoJobResult = await api.run({
        jobId,
        taskId: task.id,
        enterpriseId: task.enterpriseId,
        question: snapshot.question?.text ?? '',
        platformName,
        encryptedSecret: encryptedSecret || undefined,
        siteEntryUrl: site.entryUrl,
        terminalType: task.terminalType,
        brand: snapshot.brand
          ? {
              name: snapshot.brand.name ?? '',
              officialDomain: snapshot.brand.officialDomain,
              aliases: snapshot.brand.aliases,
            }
          : undefined,
        modelEntry: snapshot.modelEntry,
        locale: snapshot.locale,
        region: snapshot.region,
      })

      const durationMs = Date.now() - startedAt
      await reportOperatorGeoResult({
        lease,
        idempotencyKey: jobId,
        status: result.status === 'success' ? 'succeeded' : 'failed',
        result: {
          questionText: result.questionText,
          answerText: result.answerText,
          answerStatus: result.answerStatus,
          screenshotKey: result.screenshotKey,
          sessionRef: result.sessionRef,
          citations: result.citations,
          // mentions + analysisResult 由后端 computeGeoAnalysis 计算，客户端不再上报
        },
        evidence: {
          durationMs,
          platformName: result.platformName,
          errorMsg: result.errorMsg,
        },
        errorMessage: result.status !== 'success' ? result.errorMsg : undefined,
        durationMs,
      })
    } catch (error) {
      await releaseOperatorPublishTask(lease, 'error').catch((releaseError: unknown) => {
        addToast(
          'warning',
          getApiErrorMessage(releaseError, `GEO 任务 #${task.id} 租约释放失败，请等待租约自动过期`),
        )
      })
      throw error
    } finally {
      clearInterval(renewInterval)
    }
  }

  const handleRunAll = async () => {
    setRunning(true)
    try {
      const runnable = tasks.filter((task) => task.status === 'pending' || task.status === 'failed')
      if (runnable.length === 0) {
        addToast('warning', '没有可执行的 GEO 监测任务')
        return
      }
      let succeeded = 0
      let failed = 0
      for (const task of runnable) {
        try {
          await runTask(task)
          succeeded++
        } catch (error) {
          failed++
          addToast('error', getApiErrorMessage(error, `GEO 任务 #${task.id} 执行失败`))
        }
      }
      if (failed > 0) {
        addToast('warning', `已完成 ${succeeded} 个任务，${failed} 个失败`)
      } else {
        addToast('success', `已完成 ${runnable.length} 个 GEO 监测任务`)
      }
    } catch (error) {
      addToast('error', getApiErrorMessage(error, '启动 GEO 监测任务失败'))
    } finally {
      setRunning(false)
      await load()
    }
  }

  const handleRetry = async (taskId: number) => {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    try {
      await runTask(task)
      addToast('success', `GEO 任务 #${taskId} 已重新执行`)
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'GEO 任务重试失败')
    } finally {
      await load()
    }
  }

  const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'publishing')
  const failed = tasks.filter((t) => t.status === 'failed')

  // 列宽按内容权重分配：监测问题最长占 24%，错误信息 16%，
  // 状态/重试列加宽以容纳「已完成/已失败」标签和重试按钮，表头统一居中。
  const columns = [
    {
      key: 'question',
      title: '监测问题',
      width: '24%',
      align: 'left' as const,
      headAlign: 'center' as const,
      render: (t: GeoTask) => (
        <span className="block truncate text-sm text-app-text" title={t.questionText}>
          {t.questionText}
        </span>
      ),
    },
    {
      key: 'site',
      title: '收录站点',
      width: '12%',
      align: 'center' as const,
      headAlign: 'center' as const,
      render: (t: GeoTask) => (
        <span
          className="inline-block max-w-full truncate text-sm text-app-text-muted"
          title={t.inclusionSiteName}
        >
          {t.inclusionSiteName}
        </span>
      ),
    },
    {
      key: 'terminal',
      title: '监测平台',
      width: '9%',
      align: 'center' as const,
      headAlign: 'center' as const,
      render: (t: GeoTask) => (
        <span className="whitespace-nowrap text-sm text-app-text-muted">
          {t.terminalType === 2 ? '移动端' : '电脑端'}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: '13%',
      align: 'center' as const,
      headAlign: 'center' as const,
      render: (t: GeoTask) => <TaskStatusBadge status={t.status} taskType="geo" />,
    },
    {
      key: 'monitor_status',
      title: '监测状态',
      width: '10%',
      align: 'center' as const,
      headAlign: 'center' as const,
      render: (t: GeoTask) =>
        t.status === 'success' ? (
          t.brandMentioned ? (
            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-app-success/15 px-2 py-0.5 text-xs font-medium text-app-success">
              收录
            </span>
          ) : (
            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-app-elevated px-2 py-0.5 text-xs font-medium text-app-text-muted">
              未收录
            </span>
          )
        ) : (
          <span className="text-app-text-dim text-xs">—</span>
        ),
    },
    {
      key: 'retry',
      title: '重试次数',
      width: '7%',
      align: 'center' as const,
      headAlign: 'center' as const,
      render: (t: GeoTask) => (
        <span className="whitespace-nowrap text-sm text-app-text-dim">{t.retryCount}</span>
      ),
    },
    {
      key: 'error',
      title: '错误信息',
      width: '18%',
      align: 'center' as const,
      headAlign: 'center' as const,
      render: (t: GeoTask) =>
        t.errorMsg ? (
          <span
            className="inline-flex max-w-full items-center gap-1 truncate text-xs text-app-danger"
            title={t.errorMsg}
          >
            <AlertCircle size={12} className="shrink-0" />
            <span className="truncate">{t.errorMsg}</span>
          </span>
        ) : (
          <span className="text-app-text-dim text-xs">—</span>
        ),
    },
    {
      key: 'actions',
      title: '操作',
      width: '7%',
      align: 'center' as const,
      headAlign: 'center' as const,
      render: (t: GeoTask) => (
        <div className="flex items-center justify-center gap-1">
          {t.status === 'failed' && (
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw size={12} />}
              className="h-7 px-2.5 py-0 text-[11px] gap-1"
              onClick={() => handleRetry(t.id)}
            >
              重试
            </Button>
          )}
        </div>
      ),
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
            <Button variant="primary" size="sm" loading={running} icon={<Play size={14} />} onClick={handleRunAll}>
              监测全部待执行
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="进行中" value={pending.length} tone="info" icon={<Eye size={18} className="text-app-info" />} />
        <StatCard label="已完成" value={tasks.filter((t) => t.status === 'success').length} tone="success" icon={<Play size={18} className="text-app-success" />} />
        <StatCard label="失败" value={failed.length} tone="warning" icon={<AlertCircle size={18} className="text-app-warning" />} />
      </div>

      <SectionCard title="所有 GEO 监测任务">
        {loading ? (
          <PageLoader />
        ) : tasks.length === 0 ? (
          <Empty
            title="暂无 GEO 监测任务"
            description={'点击「监测全部待执行」按钮开始批量监测'}
          />
        ) : (
          <Table columns={columns} data={tasks} rowKey="id" layout="fixed" fixedRowHeight={44} />
        )}
      </SectionCard>
    </PageShell>
  )
}
