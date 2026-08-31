'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Shield } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import {
  createPlatformAuthorizationSession,
  deleteUserModelPlatform,
  getModelPlatforms,
  getUserModelPlatforms,
  getUserPlatformSecret,
  updateUserModelPlatform,
} from '@/lib/api'
import { getModelPlatformIconStyle } from '@/lib/platform-manifest'
import {
  openPlatformSession,
  openPlatformWithSecret,
  resolvePlatformSecret,
  savePlatformAuth,
} from '@/lib/services/platformAuth'
import type { ModelPlatform, UserModelPlatform } from '@/types/app'
import { useAppStore } from '@/lib/store/useAppStore'

function PlatformStatus({ authorized, expired }: { authorized: boolean; expired: boolean }) {
  if (authorized) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-app-success">
        <CheckCircle2 size={14} />
        已授权
      </span>
    )
  }
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-app-warning">
        <AlertTriangle size={14} />
        已过期
      </span>
    )
  }
  return <span className="text-xs text-app-text-dim">未授权</span>
}

function ModelPlatformIcon({ platform }: { platform: ModelPlatform }) {
  const [imageFailed, setImageFailed] = useState(false)
  const colors = getModelPlatformIconStyle(platform.name)
  const iconUrl = imageFailed ? undefined : platform.iconUrl

  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-base font-semibold"
      style={{ background: colors.bg || `${platform.color}15` }}
    >
      {iconUrl ? (
        <Image
          src={iconUrl}
          width={32}
          height={32}
          unoptimized
          className="h-8 w-8 object-contain"
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span style={{ color: colors.text || platform.color }}>{platform.icon}</span>
      )}
    </div>
  )
}

function isAccountExpired(up: UserModelPlatform | undefined): boolean {
  if (!up) return false
  if (up.authStatus === 'expired' || up.status === 'expired') return true
  if (!up.expiresAt) return false
  return new Date(up.expiresAt) < new Date()
}

function isAccountAuthorized(up: UserModelPlatform | undefined): boolean {
  if (!up || isAccountExpired(up)) return false
  return up.isActive || up.authStatus === 'active'
}

export default function ClientModelPlatformAuth() {
  const [platforms, setPlatforms] = useState<ModelPlatform[]>([])
  const [userPlatforms, setUserPlatforms] = useState<UserModelPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPlatform, setEditingPlatform] = useState<ModelPlatform | null>(null)
  const [authSessionId, setAuthSessionId] = useState<string | undefined>()
  const [authorizationSessionToken, setAuthorizationSessionToken] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const addToast = useAppStore((s) => s.addToast)

  const load = useCallback(async () => {
    const [platformsResult, accountsResult] = await Promise.allSettled([
      getModelPlatforms(),
      getUserModelPlatforms(),
    ])
    if (platformsResult.status === 'fulfilled') {
      setPlatforms(platformsResult.value)
    } else {
      addToast('error', '加载模型平台信息失败')
    }
    if (accountsResult.status === 'fulfilled') {
      setUserPlatforms(accountsResult.value)
    } else {
      // 401 is handled by the API interceptor (redirect once). Other errors keep the platform list visible.
      setUserPlatforms([])
      addToast('error', '加载已授权模型账号失败')
    }
  }, [addToast])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const getUserPlatformFrom = (accounts: UserModelPlatform[], resourceId: string) => {
    const matches = accounts.filter((up) => up.resourceId === resourceId)
    return matches.find((up) => isAccountAuthorized(up)) ?? matches[0]
  }

  const getUserPlatform = (resourceId: string) =>
    getUserPlatformFrom(userPlatforms, resourceId)

  const closeAuthModal = () => {
    setEditingPlatform(null)
    setAuthSessionId(undefined)
    setAuthorizationSessionToken(undefined)
    void window.electronAPI?.platformAuth.close(authSessionId)
  }

  const handleOpenAuth = async (platform: ModelPlatform) => {
    if (platform.configurationError || !platform.loginUrl) {
      addToast('error', platform.configurationError || '平台登录配置不可用')
      return
    }
    setEditingPlatform(platform)
    try {
      const latestAccounts = await getUserModelPlatforms()
      setUserPlatforms(latestAccounts)
      const account = getUserPlatformFrom(latestAccounts, platform.id)
      const sessionToken = await createPlatformAuthorizationSession(2, platform.id, account?.id)
      const result = await openPlatformSession(
        platform.name,
        'model',
        authSessionId,
        platform.loginUrl,
      )
      setAuthorizationSessionToken(sessionToken)
      setAuthSessionId(result.sessionId)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : '打开登录窗口失败')
    }
  }

  const handleSave = async () => {
    if (!editingPlatform || !authorizationSessionToken) {
      addToast('error', '授权会话不存在，请重新打开登录窗口')
      return
    }
    setSaving(true)
    try {
      const { label } = await savePlatformAuth({
        platformLabel: editingPlatform.label,
        sessionId: authSessionId,
        persist: async (encryptedSecret) => {
          await updateUserModelPlatform(editingPlatform.name, {
            cookie: encryptedSecret,
            isActive: true,
            platformLabel: editingPlatform.label,
            sessionToken: authorizationSessionToken,
            driverType: editingPlatform.driverType,
          })
        },
      })
      addToast('success', `${label} 授权已保存`)
      setEditingPlatform(null)
      setAuthSessionId(undefined)
      setAuthorizationSessionToken(undefined)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存授权失败'
      addToast(err instanceof Error && message.includes('Cookie') ? 'warning' : 'error', message)
    } finally {
      setSaving(false)
    }
  }

  const handleRevoke = async (platform: ModelPlatform) => {
    try {
      const latestAccounts = await getUserModelPlatforms()
      setUserPlatforms(latestAccounts)
      const up = getUserPlatformFrom(latestAccounts, platform.id)
      if (!up?.version) {
        throw new Error('未找到授权记录')
      }
      await deleteUserModelPlatform(up.id, up.version)
      addToast('info', '已撤销模型平台授权')
      await load()
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : '撤销失败')
    }
  }

  const handleOpenChat = async (platform: ModelPlatform) => {
    try {
      const latestAccounts = await getUserModelPlatforms()
      setUserPlatforms(latestAccounts)
      const up = getUserPlatformFrom(latestAccounts, platform.id)
      if (!isAccountAuthorized(up)) {
        throw new Error('平台授权已失效，请重新授权')
      }
      const secret = resolvePlatformSecret(await getUserPlatformSecret(up.id))
      await openPlatformWithSecret(platform.name, secret, 'model')
    } catch (err) {
      const message = err instanceof Error ? err.message : '打开平台失败'
      addToast(message.includes('Cookie') || message.includes('URL') || message.includes('解密') ? 'warning' : 'error', message)
    }
  }

  if (loading) return <PageLoader />

  const authorizedCount = platforms.filter((p) => isAccountAuthorized(getUserPlatform(p.id))).length

  return (
    <PageShell>
      <Card padding="lg">
        <PageHeader
          description="在各 AI 模型平台登录后，应用会保存授权信息，用于后续检索文章是否被模型收录。"
          actions={
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>
              刷新
            </Button>
          }
        >
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-app-border">
            <Shield size={15} className="text-app-accent" />
            <span className="text-sm text-app-text-muted">已授权</span>
            <span className="text-sm font-semibold text-app-text tabular-nums">
              {authorizedCount} / {platforms.length}
            </span>
          </div>
        </PageHeader>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 min-w-0">
        {platforms.map((platform) => {
          const up = getUserPlatform(platform.id)
          const expired = isAccountExpired(up)
          const authorized = isAccountAuthorized(up)

          return (
            <Card key={platform.id} padding="lg" className="flex flex-col min-w-0 h-full">
              <div className="flex items-center gap-3 min-w-0">
                <ModelPlatformIcon platform={platform} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-app-text truncate">{platform.label}</h3>
                  <div className="mt-0.5">
                    <PlatformStatus authorized={authorized} expired={expired} />
                  </div>
                </div>
              </div>

              <p className={`text-xs mt-3 min-h-[1rem] ${platform.configurationError ? 'text-app-danger' : 'text-app-text-dim'}`}>
                {platform.configurationError ? (
                  platform.configurationError
                ) : up?.accountName ? (
                  <span className="block truncate">{up.accountName}</span>
                ) : null}
                {!platform.configurationError && (up?.lastLoginAt
                  ? `更新于 ${new Date(up.lastLoginAt).toLocaleDateString('zh-CN')}`
                  : '尚未配置授权')}
              </p>

              <div className="mt-auto pt-4 space-y-2">
                <Button
                  size="md"
                  variant="primary"
                  disabled={Boolean(platform.configurationError)}
                  onClick={() => void handleOpenAuth(platform)}
                  className="w-full"
                >
                  {authorized ? '更新授权' : '立即授权'}
                </Button>
                {(authorized || up?.isActive || expired) && (
                  <div className="flex items-center gap-1">
                    {authorized && (
                      <button
                        type="button"
                        onClick={() => void handleOpenChat(platform)}
                        className="flex-1 inline-flex items-center justify-center gap-1 h-8 text-xs text-app-text-muted hover:text-app-accent rounded-lg hover:bg-app-hover transition-colors"
                      >
                        <ExternalLink size={13} />
                        打开平台
                      </button>
                    )}
                    {up && (
                      <button
                        type="button"
                        onClick={() => void handleRevoke(platform)}
                        className="flex-1 inline-flex items-center justify-center h-8 text-xs text-app-text-dim hover:text-app-danger rounded-lg hover:bg-app-danger-subtle transition-colors"
                      >
                        撤销授权
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <Modal
        open={!!editingPlatform}
        onClose={closeAuthModal}
        title={`${editingPlatform?.label} - 模型平台授权`}
        width="lg"
      >
        <div className="space-y-5">
          <div className="bg-app-elevated border border-app-border rounded-xl p-5 text-sm text-app-text-muted leading-relaxed">
            <p className="font-medium text-app-text mb-3">操作步骤</p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>点击「打开登录窗口」</li>
              <li>在弹出的浏览器窗口中登录{editingPlatform?.label}</li>
              <li>登录完成后回到本页，点击「保存授权」</li>
            </ol>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
            <Button
              variant="secondary"
              icon={<ExternalLink size={14} />}
              onClick={() => {
                if (!editingPlatform) return
                void handleOpenAuth(editingPlatform)
              }}
            >
              打开登录窗口
            </Button>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={closeAuthModal}>
                取消
              </Button>
              <Button variant="primary" loading={saving} onClick={handleSave}>
                保存授权
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
