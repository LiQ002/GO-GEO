'use client'

import { useState } from 'react'
import { BarChart3, Eye, EyeOff, Globe, Lock, LogIn, User } from 'lucide-react'
import { adminLogin, getApiErrorMessage, getBaseURL, updateBaseURL } from '@/lib/api'
import { useAppStore } from '@/lib/store/useAppStore'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import WindowControls from '@/components/layout/WindowControls'

export default function OperatorLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [serverUrl, setServerUrl] = useState(() => getBaseURL())
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const storeLogin = useAppStore((state) => state.login)
  const addToast = useAppStore((state) => state.addToast)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      setError('请填写用户名和密码')
      return
    }
    setError('')
    setLoading(true)
    try {
      updateBaseURL(serverUrl)
      const { accessToken, refreshToken, user } = await adminLogin({ username, password })
      await storeLogin(accessToken, refreshToken, user)
      addToast('success', `欢迎回来，${user.name}！`)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '用户名或密码错误'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-app-bg box-border overflow-hidden">
      <div className="drag-region h-2.5 shrink-0" aria-hidden />
      <div className="min-h-0 flex-1 p-2.5 pt-0 box-border">
        <div className="h-full flex flex-col rounded-xl border border-app-border bg-app-surface shadow-(--shadow-card) overflow-hidden">
          <header className="drag-region flex items-center justify-end h-[52px] px-6 border-b border-app-border flex-shrink-0">
            <WindowControls />
          </header>

          <div className="flex-1 flex items-center justify-center px-6 py-10 overflow-auto">
            <div className="w-full max-w-[400px]">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-app-accent to-app-accent-dark shadow-sm mb-5">
                  <BarChart3 size={24} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold text-app-text tracking-tight">GEO助手</h1>
                <p className="text-sm text-app-text-muted mt-1.5">运营管理端</p>
              </div>

              <div className="bg-app-surface border border-app-border rounded-2xl px-7 py-7 shadow-(--shadow-card)">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <Input
                    label="服务器地址"
                    placeholder="http://localhost:8080"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    prefix={<Globe size={16} />}
                  />
                  <Input
                    label="用户名"
                    placeholder="输入运营账号"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    prefix={<User size={16} />}
                  />
                  <Input
                    label="密码"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    prefix={<Lock size={16} />}
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-app-text-dim hover:text-app-text transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                  {error && (
                    <p className="text-sm text-app-danger bg-app-danger-subtle border border-app-danger/20 rounded-lg px-4 py-3">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={loading}
                    icon={<LogIn size={16} />}
                    className="w-full"
                  >
                    登录
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
