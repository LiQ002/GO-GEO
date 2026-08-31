'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bot,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Key,
  LayoutDashboard,
  LogOut,
  Radio,
  ScrollText,
  Settings,
  Users,
} from 'lucide-react'
import { useAppStore } from '@/lib/store/useAppStore'
import type { AppMode } from '@/types/app'

interface NavItem {
  path: string
  icon: React.ReactNode
  label: string
}

const operatorNav: NavItem[] = [
  { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: '数据概览' },
  { path: '/users', icon: <Users size={20} />, label: '用户管理' },
  { path: '/articles', icon: <FileText size={20} />, label: '文章管理' },
  { path: '/publishing', icon: <Radio size={20} />, label: '发布控制' },
  { path: '/geo-monitoring', icon: <Eye size={20} />, label: 'GEO 监测' },
  { path: '/logs', icon: <ScrollText size={20} />, label: '发布日志' },
  { path: '/settings', icon: <Settings size={20} />, label: '系统设置' },
]

const clientNav: NavItem[] = [
  { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: '我的概览' },
  // { path: '/tasks', icon: <ListTodo size={20} />, label: '发布任务' },
  { path: '/platforms', icon: <Key size={20} />, label: '平台授权' },
  { path: '/model-platforms', icon: <Bot size={20} />, label: '模型授权' },
  { path: '/settings', icon: <Settings size={20} />, label: '账号设置' },
]

interface SidebarProps {
  mode: AppMode
}

export default function Sidebar({ mode }: SidebarProps) {
  const pathname = usePathname()
  const currentUser = useAppStore((state) => state.currentUser)
  const logout = useAppStore((state) => state.logout)
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useAppStore((state) => state.toggleSidebar)
  const navItems = mode === 'operator' ? operatorNav : clientNav

  return (
    <aside
      className={[
        'flex shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-[72px]' : 'w-[238px]',
      ].join(' ')}
    >
      <div className="drag-region flex h-[52px] items-center gap-3 overflow-hidden border-b border-slate-200/80 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600">
          <BarChart3 size={16} className="text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-900">GEO助手</div>
            <div className="text-[11px] font-medium text-slate-400">
              {mode === 'operator' ? '运营端' : '客户端'}
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-x-hidden overflow-y-auto py-6" aria-label="主导航">
        <div className="space-y-2 px-4">
          {navItems.map((item) => {
            const isActive = pathname === item.path
            return (
              <Link
                key={item.path}
                href={item.path}
                title={sidebarCollapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'group relative flex min-h-[44px] items-center gap-3 rounded-xl px-1 transition-colors duration-150',
                  isActive
                    ? 'font-medium text-indigo-600'
                    : 'text-slate-400 hover:text-slate-800',
                ].join(' ')}
              >
                {isActive && (
                  <span className="absolute -right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-indigo-600" />
                )}
                <span
                  className={[
                    'shrink-0 transition-colors',
                    isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-800',
                  ].join(' ')}
                >
                  {item.icon}
                </span>
                {!sidebarCollapsed && <span className="text-sm leading-none">{item.label}</span>}
              </Link>
            )
          })}
        </div>
      </nav>

      {currentUser && (
        <div className="space-y-1.5 border-t border-slate-200/80 px-3 py-3">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-2.5 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                <span className="text-xs font-bold text-indigo-600">
                  {currentUser.name.charAt(0)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">{currentUser.name}</div>
                <div className="truncate text-[11px] text-slate-400">@{currentUser.username}</div>
              </div>
            </div>
          )}
          <button
            onClick={() => void logout()}
            title={sidebarCollapsed ? '退出登录' : undefined}
            className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} className="shrink-0" />
            {!sidebarCollapsed && <span>退出登录</span>}
          </button>
        </div>
      )}

      <div className="border-t border-slate-200/80 px-3 py-2.5">
        <button
          onClick={toggleSidebar}
          className="flex h-9 w-full items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
          aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  )
}
