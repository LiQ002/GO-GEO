'use client'

import WindowControls from './WindowControls'
import type { AppMode } from '@/types/app'

const titleMap: Record<string, string> = {
  '/dashboard': '数据概览',
  '/users': '用户管理',
  '/articles': '文章管理',
  '/publishing': '发布控制',
  '/logs': '发布日志',
  '/settings': '系统设置',
  '/tasks': '发布任务',
  '/platforms': '平台授权',
  '/model-platforms': '模型授权',
}

const subtitleMap: Record<string, string> = {
  '/dashboard': '查看关键指标与最近动态',
  '/users': '管理平台注册用户',
  '/articles': '浏览与筛选全部文章',
  '/publishing': '监控与控制发布任务',
  '/logs': '查看历史发布记录',
  '/settings': '配置系统参数',
  '/tasks': '管理自动发布与任务队列',
  '/platforms': '配置各平台 授权',
  '/model-platforms': '配置 AI 模型平台 授权',
}

interface HeaderProps {
  pathname: string
  mode: AppMode
}

export default function Header({ pathname, mode }: HeaderProps) {
  const title = titleMap[pathname] ?? 'Article Publisher'
  const subtitle = subtitleMap[pathname]

  return (
    <header className="drag-region flex h-[52px] shrink-0 items-center border-b border-slate-200/80 bg-white/90 px-6 backdrop-blur lg:px-8">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-[15px] font-semibold text-slate-900 select-none">{title}</h1>
          <span className="hidden text-xs font-normal text-slate-400 sm:inline">
            · {mode === 'operator' ? '运营端' : '客户端'}
          </span>
        </div>
        {subtitle && (
          <p className="mt-0.5 hidden truncate text-xs text-slate-400 sm:block">{subtitle}</p>
        )}
      </div>

      <div className="flex-1" />

      <WindowControls />
    </header>
  )
}
