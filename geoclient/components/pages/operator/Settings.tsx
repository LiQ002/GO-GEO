'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Server } from 'lucide-react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'
import PageShell from '@/components/ui/PageShell'
import Section from '@/components/ui/Section'
import BrowserRuntimeSettings from '@/components/pages/settings/BrowserRuntimeSettings'
import {
  checkServerHealth,
  getApiErrorMessage,
  getSettings,
  saveSettings,
  updateBaseURL,
  getBaseURL,
} from '@/lib/api'
import { useAppStore } from '@/lib/store/useAppStore'

export default function OperatorSettings() {
  const [serverUrl, setServerUrl] = useState(() => getBaseURL())
  const [autoPublish, setAutoPublish] = useState(false)
  const [retryCount, setRetryCount] = useState(3)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)
  const addToast = useAppStore((s) => s.addToast)

  useEffect(() => {
    void getSettings().then((s) => {
      setAutoPublish(s.autoPublish)
      setRetryCount(s.retryCount)
    })
  }, [])

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      await checkServerHealth(serverUrl)
      setTestResult('ok')
      addToast('success', '连接成功！服务器响应正常')
    } catch (error) {
      setTestResult('fail')
      addToast('error', getApiErrorMessage(error, '连接失败，请检查服务器地址和端口'))
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      updateBaseURL(serverUrl)
      await saveSettings({ serverUrl, autoPublish, retryCount })
      addToast('success', '设置保存成功')
    } catch {
      addToast('error', '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell narrow>
      <Section title="API 服务器配置" icon={<Server size={16} />}>
        <div className="space-y-4">
          <div>
            <Input
              label="服务器地址"
              placeholder="例如：http://localhost:8080"
              value={serverUrl}
              onChange={(e) => {
                setServerUrl(e.target.value)
                setTestResult(null)
              }}
            />
            <p className="text-xs text-app-text-dim mt-1.5">
              输入后端 API 服务器的完整地址（包含协议和端口）
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" loading={testing} icon={<Server size={14} />} onClick={handleTest}>
              测试连接
            </Button>
            {testResult === 'ok' && (
              <div className="flex items-center gap-1.5 text-xs text-app-success">
                <CheckCircle2 size={13} />
                连接正常
              </div>
            )}
            {testResult === 'fail' && (
              <span className="text-xs text-app-danger">连接失败</span>
            )}
          </div>
        </div>
      </Section>

      <BrowserRuntimeSettings />

      <Section title="发布设置">
        <div className="space-y-5">
          <Switch
            checked={autoPublish}
            onChange={setAutoPublish}
            label="自动发布"
            description="有新文章时自动触发发布流程"
          />

          <div>
            <label className="text-sm font-medium text-app-text-muted block mb-2">失败重试次数</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRetryCount(n)}
                  className={[
                    'w-10 h-9 rounded-lg border text-sm font-medium transition-colors',
                    retryCount === n
                      ? 'bg-app-accent border-app-accent text-white'
                      : 'bg-app-surface border-app-border text-app-text-muted hover:border-app-border-strong',
                  ].join(' ')}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button variant="primary" loading={saving} onClick={handleSave}>
          保存设置
        </Button>
      </div>
    </PageShell>
  )
}
