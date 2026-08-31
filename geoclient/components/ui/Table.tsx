'use client'

import { clsx } from 'clsx'

interface Column<T> {
  key: string
  title: string
  width?: string
  align?: 'left' | 'center' | 'right'
  headAlign?: 'left' | 'center' | 'right'
  render?: (row: T, index: number) => React.ReactNode
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: keyof T | ((row: T) => string | number)
  onRowClick?: (row: T) => void
  className?: string
  layout?: 'auto' | 'fixed'
  fixedRowHeight?: number
  loading?: boolean
}

const alignClass = (align?: 'left' | 'center' | 'right') =>
  align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'

export default function Table<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  className,
  layout = 'auto',
  fixedRowHeight,
}: TableProps<T>) {
  const getKey = (row: T) => {
    if (typeof rowKey === 'function') return rowKey(row)
    return row[rowKey] as string | number
  }

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className={clsx('w-full text-sm', layout === 'fixed' && 'table-fixed')}>
        <thead>
          <tr className="border-b border-app-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  'py-3 px-4 text-xs font-semibold text-app-text-dim uppercase tracking-wider whitespace-nowrap',
                  alignClass(col.headAlign ?? col.align),
                )}
                style={{ width: col.width }}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={getKey(row)}
              onClick={() => onRowClick?.(row)}
              style={fixedRowHeight ? { height: fixedRowHeight } : undefined}
              className={clsx(
                'border-b border-app-border/50 transition-colors',
                onRowClick && 'cursor-pointer hover:bg-app-elevated/50',
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={clsx('px-4 text-app-text-muted align-middle', alignClass(col.align))}
                >
                  {col.render ? col.render(row, index) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-app-border">
      <span className="text-xs text-app-text-dim">
        共 {total} 条，第 {page}/{totalPages} 页
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 text-xs rounded-lg border border-app-border text-app-text-muted hover:bg-app-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          上一页
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 text-xs rounded-lg border border-app-border text-app-text-muted hover:bg-app-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          下一页
        </button>
      </div>
    </div>
  )
}
