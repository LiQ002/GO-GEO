'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Chrome, FolderOpen, Trash2 } from 'lucide-react'
import type { BrowserRuntimeConfiguration } from '@/lib/ipc-contract'
import { useAppStore } from '@/lib/store/useAppStore'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Section from '@/components/ui/Section'

const EMPTY_CONFIGURATION: BrowserRuntimeConfiguration = {
  executablePath: '',
  valid: false,
  error: '尚未配置本机 Chrome',
}

export default function BrowserRuntimeSettings() {
  const [configuration, setConfiguration] = useState(EMPTY_CONFIGURATION)
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const addToast = useAppStore((state) => state.addToast)

  useEffect(() => {
    let active = true
    const api = window.electronAPI?.browserRuntime
    if (!api) {
      queueMicrotask(() => {
        if (active) setLoading(false)
      })
      return () => {
        active = false
      }
    }

    void api.get()
      .then((result) => {
        if (active) setConfiguration(result)
      })
      .catch((error) => {
        if (active) {
          addToast('error', error instanceof Error ? error.message : '读取 Chrome 配置失败')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [addToast])

  const handleSelect = async () => {
    const api = window.electronAPI?.browserRuntime
    if (!api) {
      addToast('error', '当前环境不支持选择本机 Chrome')
      return
    }
    setSelecting(true)
    try {
      const result = await api.select()
      setConfiguration(result)
      if (result.valid) addToast('success', '本机 Chrome 路径已保存')
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : '选择 Chrome 失败')
    } finally {
      setSelecting(false)
    }
  }

  const handleClear = async () => {
    const api = window.electronAPI?.browserRuntime
    if (!api) return
    setClearing(true)
    try {
      setConfiguration(await api.clear())
      addToast('info', '本机 Chrome 配置已清除')
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : '清除 Chrome 配置失败')
    } finally {
      setClearing(false)
    }
  }

  return (
    <Section
      title="浏览器运行环境"
      description="平台授权、文章发布和 GEO 检测将使用这里选择的本机 Google Chrome；安装包不再内置 Chromium。"
      icon={<Chrome size={16} />}
    >
      <div className="space-y-3">
        <Input
          label="Chrome 可执行文件"
          value={configuration.executablePath}
          placeholder={loading ? '正在读取配置…' : '尚未选择 chrome.exe'}
          readOnly
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            icon={<FolderOpen size={14} />}
            loading={selecting}
            onClick={() => void handleSelect()}
          >
            选择 Chrome
          </Button>
          {configuration.executablePath ? (
            <Button
              variant="ghost"
              icon={<Trash2 size={14} />}
              loading={clearing}
              onClick={() => void handleClear()}
            >
              清除
            </Button>
          ) : null}
          {!loading && configuration.valid ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-app-success">
              <CheckCircle2 size={13} />
              Chrome 路径有效
            </span>
          ) : null}
        </div>
        {!loading && !configuration.valid ? (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-app-warning">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
            {configuration.error || '请先选择本机 Chrome 可执行文件'}
          </p>
        ) : null}
      </div>
    </Section>
  )
}
