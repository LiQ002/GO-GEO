import { DiffOutlined, FileSearchOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history, useAccess } from '@umijs/max';
import {
  App,
  Button,
  Modal,
  Progress,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useMemo, useRef, useState } from 'react';
import {
  salesDiagnosisServiceCompareSalesDiagnoses,
  salesDiagnosisServiceListSalesDiagnoses,
} from '@/services/geo-admin/salesDiagnosisService';
import { pageTokenFor } from '@/utils/admin-api';
import {
  salesDiagnosisStatusColors,
  salesDiagnosisStatusLabel,
  salesDiagnosisStatusOptions,
  salesDiagnosisStatusValueEnum,
  salesDiagnosisSubjectTypeLabel,
  salesDiagnosisSubjectTypeOptions,
} from '@/utils/sales-diagnosis-enums';

const metricLabels: Record<string, string> = {
  brand_mention_rate: '品牌提及率',
  citation_rate: '可核验引用率',
  brand_share_of_voice: '品牌声量占比',
};

const percent = (value?: number) => `${((value ?? 0) * 100).toFixed(1)}%`;

export default function SalesDiagnosesPage() {
  const actionRef = useRef<ActionType | null>(null);
  const access = useAccess();
  const { message } = App.useApp();
  const [selected, setSelected] = useState<API.SalesDiagnosis[]>([]);
  const [comparison, setComparison] =
    useState<API.CompareSalesDiagnosesReply>();
  const [comparing, setComparing] = useState(false);

  const columns = useMemo<ProColumns<API.SalesDiagnosis>[]>(
    () => [
      {
        title: '诊断编号',
        dataIndex: 'keyword',
        width: 190,
        render: (_, record) => (
          <Button
            type="link"
            style={{ paddingInline: 0 }}
            onClick={() => history.push(`/sales/diagnoses/${record.id}`)}
          >
            {record.code ?? record.id}
          </Button>
        ),
      },
      {
        title: '诊断名称',
        dataIndex: 'name',
        search: false,
        ellipsis: true,
      },
      {
        title: '客户 / 品牌',
        dataIndex: ['profile', 'customerName'],
        search: false,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>
              {record.profile?.customerName ?? '-'}
            </Typography.Text>
            <Typography.Text type="secondary">
              {record.profile?.brandName ?? '未填写品牌'}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: '对象',
        dataIndex: 'subjectType',
        valueType: 'select',
        fieldProps: { options: salesDiagnosisSubjectTypeOptions },
        render: (_, record) => (
          <Tag>{salesDiagnosisSubjectTypeLabel(record.subjectType)}</Tag>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: salesDiagnosisStatusValueEnum(),
        fieldProps: { options: salesDiagnosisStatusOptions },
        render: (_, record) => (
          <Tag color={salesDiagnosisStatusColors[record.status ?? 0]}>
            {salesDiagnosisStatusLabel(record.status)}
          </Tag>
        ),
      },
      {
        title: '执行进度',
        dataIndex: 'taskCount',
        search: false,
        width: 150,
        render: (_, record) => {
          const total = record.taskCount ?? 0;
          const done =
            (record.succeededTaskCount ?? 0) + (record.failedTaskCount ?? 0);
          return (
            <Progress
              size="small"
              percent={total > 0 ? Math.round((done / total) * 100) : 0}
              format={() => `${done}/${total}`}
            />
          );
        },
      },
      {
        title: '样本配置',
        dataIndex: 'modelCount',
        search: false,
        width: 120,
        render: (_, record) =>
          `${record.questionCount ?? 0} 问题 × ${record.modelCount ?? 0} 模型`,
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        valueType: 'dateTime',
        search: false,
        sorter: false,
        width: 170,
        render: (_, record) =>
          record.createdAt
            ? dayjs(record.createdAt).format('YYYY-MM-DD HH:mm')
            : '-',
      },
      {
        title: '操作',
        valueType: 'option',
        width: 90,
        render: (_, record) => [
          <Button
            key="detail"
            type="link"
            onClick={() => history.push(`/sales/diagnoses/${record.id}`)}
          >
            详情
          </Button>,
        ],
      },
    ],
    [],
  );

  const compare = async () => {
    if (selected.length !== 2 || !selected[0].id || !selected[1].id) {
      message.warning('请选择两次诊断进行对比');
      return;
    }
    setComparing(true);
    try {
      setComparison(
        await salesDiagnosisServiceCompareSalesDiagnoses({
          baselineId: selected[0].id,
          comparisonId: selected[1].id,
        }),
      );
    } finally {
      setComparing(false);
    }
  };

  return (
    <PageContainer
      title="GEO 售前诊断记录"
      subTitle="同一销售机会可发起多次诊断，所有模型回答和尝试历史都会保留。"
      extra={
        <Button
          icon={<FileSearchOutlined />}
          disabled={!access.canSalesDiagnosisManage}
          onClick={() => history.push('/sales/opportunities')}
        >
          从销售机会发起
        </Button>
      }
    >
      <ProTable<API.SalesDiagnosis>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        rowSelection={{
          selectedRowKeys: selected.flatMap((item) =>
            item.id ? [item.id] : [],
          ),
          onChange: (_, rows) => setSelected(rows.slice(-2)),
          preserveSelectedRowKeys: false,
        }}
        tableAlertRender={({ selectedRowKeys }) => (
          <Space>
            已选择 {selectedRowKeys.length} 项
            <Typography.Text type="secondary">
              请选择同一客户的两次诊断
            </Typography.Text>
          </Space>
        )}
        tableAlertOptionRender={() => (
          <Button
            type="link"
            icon={<DiffOutlined />}
            loading={comparing}
            disabled={selected.length !== 2}
            onClick={() => void compare()}
          >
            对比诊断
          </Button>
        )}
        request={async (params) => {
          const reply = await salesDiagnosisServiceListSalesDiagnoses({
            pageSize: params.pageSize,
            pageToken: pageTokenFor(params.current, params.pageSize),
            keyword: params.keyword,
            status: params.status ? Number(params.status) : undefined,
            subjectType: params.subjectType
              ? Number(params.subjectType)
              : undefined,
          });
          return {
            data: reply.items ?? [],
            success: true,
            total: Number(reply.totalSize ?? 0),
          };
        }}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
      />

      <Modal
        title="诊断指标对比"
        width={860}
        open={Boolean(comparison)}
        footer={null}
        onCancel={() => setComparison(undefined)}
      >
        <Table<API.SalesDiagnosisMetricComparison>
          rowKey="metricCode"
          pagination={false}
          dataSource={comparison?.metrics ?? []}
          columns={[
            {
              title: '指标',
              dataIndex: 'metricCode',
              render: (value: string) => metricLabels[value] ?? value,
            },
            {
              title: comparison?.baseline?.name ?? '基线诊断',
              dataIndex: 'baselineValue',
              render: percent,
            },
            {
              title: comparison?.comparison?.name ?? '对比诊断',
              dataIndex: 'comparisonValue',
              render: percent,
            },
            {
              title: '变化',
              dataIndex: 'delta',
              render: (value?: number) => (
                <Typography.Text type={(value ?? 0) < 0 ? 'danger' : undefined}>
                  {(value ?? 0) > 0 ? '+' : ''}
                  {percent(value)}
                </Typography.Text>
              ),
            },
          ]}
        />
      </Modal>
    </PageContainer>
  );
}
