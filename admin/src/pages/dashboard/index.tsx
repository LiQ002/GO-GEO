import {
  PageContainer,
  ProCard,
  StatisticCard,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Alert, Button, List, Table, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { dashboardServiceGetDashboard } from '@/services/geo-admin/dashboardService';

export default function DashboardPage() {
  const [data, setData] = useState<API.Dashboard>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    dashboardServiceGetDashboard({ trendDays: 14 })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'));
  }, []);
  return (
    <PageContainer
      title="运营总览"
      subTitle="平台关键业务、执行健康度和待处理告警"
    >
      {error && <Alert type="error" showIcon message={error} />}
      <ProCard gutter={16} wrap>
        {(data?.metrics ?? []).map((v) => (
          <StatisticCard
            key={v.key}
            colSpan={{ xs: 24, sm: 12, lg: 8, xl: 4 }}
            statistic={{ title: v.label, value: Number(v.value ?? 0) }}
          />
        ))}
      </ProCard>
      <ProCard title="近 14 天趋势" style={{ marginTop: 16 }}>
        <Table
          rowKey="date"
          pagination={false}
          dataSource={data?.trends ?? []}
          columns={[
            { title: '日期', dataIndex: 'date' },
            { title: '新增文章', dataIndex: 'articles' },
            { title: '发布成功', dataIndex: 'publishSucceeded' },
            { title: 'GEO 成功', dataIndex: 'geoSucceeded' },
            { title: '失败任务', dataIndex: 'failedTasks' },
          ]}
        />
      </ProCard>
      <ProCard
        title="待处理告警"
        style={{ marginTop: 16 }}
        extra={
          <Button
            type="link"
            onClick={() => history.push('/operations/alerts')}
          >
            查看全部
          </Button>
        }
      >
        <List
          dataSource={data?.alerts ?? []}
          locale={{ emptyText: '暂无未处理告警' }}
          renderItem={(v) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <>
                    <Tag color={v.severity === 'critical' ? 'red' : 'orange'}>
                      {v.severity}
                    </Tag>
                    {v.title}
                  </>
                }
                description={`${v.resourceType ?? ''} ${v.resourceId ?? ''}`}
              />
            </List.Item>
          )}
        />
      </ProCard>
    </PageContainer>
  );
}
