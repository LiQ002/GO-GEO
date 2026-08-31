'use client'

import { useState } from 'react'
import { Bell, Lock, Server, User } from 'lucide-react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'
import PageShell from '@/components/ui/PageShell'
import Section from '@/components/ui/Section'
import BrowserRuntimeSettings from '@/components/pages/settings/BrowserRuntimeSettings'
import {
  changeEnterprisePassword,
  getApiErrorMessage,
  getBaseURL,
  updateBaseURL,
} from '@/lib/api'
import { useAppStore } from '@/lib/store/useAppStore'

export default function ClientSettings() {
  const currentUser = useAppStore((state) => state.currentUser)
  const addToast = useAppStore((state) => state.addToast)
  const [serverUrl, setServerUrl] = useState(() => getBaseURL())
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notifyEnabled, setNotifyEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  const handleSaveServer = () => {
    try {
      updateBaseURL(serverUrl)
      addToast('success', '服务器地址已保存')
    } catch (error) {
      addToast('error', getApiErrorMessage(error, '服务器地址无效'))
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      addToast('error', '两次密码不一致')
      return
    }
    if (newPassword.length < 6) {
      addToast('error', '新密码至少 6 位')
      return
    }
    setSaving(true)
    try {
      await changeEnterprisePassword(oldPassword, newPassword)
      addToast('success', '密码修改成功')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      addToast('error', getApiErrorMessage(error, '密码修改失败'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell narrow>
      <Section title="个人信息" icon={<User size={16} />}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-app-info-subtle flex items-center justify-center flex-shrink-0 shadow-(--shadow-card)">
            <span className="text-lg font-semibold text-app-accent">
              {currentUser?.name.charAt(0)}
            </span>
          </div>
          <div>
            <div className="text-sm font-semibold text-app-text">{currentUser?.name}</div>
            <div className="text-sm text-app-text-muted">@{currentUser?.username}</div>
            {currentUser?.email && (
              <div className="text-xs text-app-text-dim mt-0.5">{currentUser.email}</div>
            )}
          </div>
        </div>
      </Section>

      <Section title="服务器地址" icon={<Server size={16} />}>
        <div className="flex gap-2">
          <Input
            placeholder="http://localhost:8080"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            className="flex-1"
          />
          <Button variant="secondary" onClick={handleSaveServer}>保存</Button>
        </div>
      </Section>

      <BrowserRuntimeSettings />

      <Section title="修改密码" icon={<Lock size={16} />}>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <Input
            label="当前密码"
            type="password"
            placeholder="输入当前密码"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
          <Input
            label="新密码"
            type="password"
            placeholder="至少 6 位"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="确认新密码"
            type="password"
            placeholder="再次输入新密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <div className="flex justify-end pt-1">
            <Button type="submit" variant="primary" loading={saving}>修改密码</Button>
          </div>
        </form>
      </Section>

      <Card padding="lg">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={16} className="text-app-accent" />
          <h3 className="text-sm font-semibold text-app-text">通知设置</h3>
        </div>
        <Switch
          checked={notifyEnabled}
          onChange={setNotifyEnabled}
          label="发布结果通知"
          description="发布完成或失败时推送通知"
        />
      </Card>
    </PageShell>
  )
}
