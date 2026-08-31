'use client'

import Empty from '@/components/ui/Empty'
import PageHeader from '@/components/ui/PageHeader'
import PageShell from '@/components/ui/PageShell'
import { SectionCard } from '@/components/ui/Section'

export default function OperatorLogs() {
  return (
    <PageShell>
      <PageHeader description="日志页面已切换到 OpenAPI 契约；等待后端提供跨企业发布日志接口。" />
      <SectionCard title="发布日志">
        <Empty
          title="跨企业日志接口尚未开放"
          description="当前契约只有企业自身日志接口，运营端不会再调用旧的 /api/logs。"
        />
      </SectionCard>
    </PageShell>
  )
}
