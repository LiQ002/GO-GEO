'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/Section'
import Input from '@/components/ui/Input'
import Table, { Pagination } from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import Empty from '@/components/ui/Empty'
import { getUsers } from '@/lib/api'
import type { User } from '@/types/app'
import { useAppStore } from '@/lib/store/useAppStore'

export default function OperatorUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const addToast = useAppStore((s) => s.addToast)

  const load = useCallback((p: number, s: string) => {
    setLoading(true)
    getUsers({ page: p, pageSize: 20, search: s })
      .then((res) => {
        setUsers(res.items)
        setTotal(res.total)
      })
      .catch(() => addToast('error', '获取用户列表失败'))
      .finally(() => setLoading(false))
  }, [addToast])

  useEffect(() => {
    const timer = window.setTimeout(() => load(1, ''), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    load(1, search)
  }

  const publishRate = (u: User) => {
    if (u.articleCount <= 0) return 0
    // publishedCount 可能大于 articleCount（一篇文章发布到多个平台），
    // 发布率上限为 100%。
    return Math.min(Math.round((u.publishedCount / u.articleCount) * 100), 100)
  }

  const columns = [
    {
      key: 'name',
      title: '用户',
      render: (u: User) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-app-accent/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-app-accent-light">
              {u.name.charAt(0)}
            </span>
          </div>
          <div>
            <div className="text-sm font-medium text-app-text">{u.name}</div>
            <div className="text-xs text-app-text-dim">@{u.username}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      title: '邮箱',
      render: (u: User) => (
        <span className="text-sm text-app-text-muted">{u.email || '—'}</span>
      ),
    },
    {
      key: 'articleCount',
      title: '文章数',
      render: (u: User) => (
        <span className="text-sm text-app-text">{u.articleCount}</span>
      ),
    },
    {
      key: 'publishedCount',
      title: '已发布',
      render: (u: User) => (
        <span className="text-sm text-app-success font-medium">{u.publishedCount}</span>
      ),
    },
    {
      key: 'rate',
      title: '发布率',
      render: (u: User) => {
        const rate = publishRate(u)
        return (
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-app-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-app-accent rounded-full"
                style={{ width: `${rate}%` }}
              />
            </div>
            <span className="text-xs text-app-text-muted">{rate}%</span>
          </div>
        )
      },
    },
    {
      key: 'createdAt',
      title: '注册时间',
      render: (u: User) => (
        <span className="text-xs text-app-text-dim">
          {new Date(u.createdAt).toLocaleDateString('zh-CN')}
        </span>
      ),
    },
  ]

  return (
    <PageShell>
      <PageHeader
        actions={
          <form onSubmit={handleSearch}>
            <Input
              placeholder="搜索用户名或姓名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<Search size={14} />}
              className="w-56"
            />
          </form>
        }
      />

      <SectionCard title="用户列表" count={total}>
        {loading ? (
          <PageLoader />
        ) : users.length === 0 ? (
          <Empty title="暂无用户" description="还没有注册用户" />
        ) : (
          <>
            <Table
              columns={columns}
              data={users}
              rowKey="id"
            />
            <Pagination
              page={page}
              pageSize={20}
              total={total}
              onChange={(p) => {
                setPage(p)
                load(p, search)
              }}
            />
          </>
        )}
      </SectionCard>
    </PageShell>
  )
}
