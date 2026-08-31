import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProForm,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Descriptions,
  Divider,
  Drawer,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import {
  planServiceCreatePlan,
  planServiceDeletePlan,
  planServiceListPlans,
  planServiceUpdatePlan,
} from '@/services/geo-admin/planService';
import { pageTokenFor } from '@/utils/admin-api';
import {
  optionLabel,
  optionValueEnum,
  PlanStatus,
  planFeatureOptions,
  planMetricOptions,
  planStatusOptions,
  quotaPeriodOptions,
  QuotaPeriod,
} from '@/utils/platform-enums';

type PlanForm = {
  code?: string;
  name?: string;
  status?: number;
  description?: string;
  halfYearlyPriceYuan?: number;
  yearlyPriceYuan?: number;
  billingCycle?: string;
  grantedPoints?: number;
  sortOrder?: number;
  visibleToEnterprise?: boolean;
};

// 价格统一展示：将半年价/年价合并为一列。
// 规则：
//   - 两档都有：分两行展示，年付在前、半年付在后
//   - 只有年付：单行 "¥xxx / 年"
//   - 只有半年付：单行 "¥xxx / 半年"
//   - 都为 0：显示 "-"
function renderPrice(record: API.Plan) {
  const half = Number(record.halfYearlyPriceMinorUnits ?? 0);
  const year = Number(record.yearlyPriceMinorUnits ?? 0);
  if (half <= 0 && year <= 0) {
    return <Typography.Text type="secondary">-</Typography.Text>;
  }
  const lines: ReactNode[] = [];
  if (year > 0) {
    lines.push(
      <div key="year">
        <span className="font-medium">¥{(year / 100).toFixed(2)}</span>
        <span className="ml-1 text-[#8a8a91]">/ 年</span>
      </div>,
    );
  }
  if (half > 0) {
    lines.push(
      <div key="half">
        <span className="font-medium">¥{(half / 100).toFixed(2)}</span>
        <span className="ml-1 text-[#8a8a91]">/ 半年</span>
      </div>,
    );
  }
  return <div className="leading-5">{lines}</div>;
}

const PlansPage = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [editing, setEditing] = useState<API.Plan>();
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<API.Plan>();
  // 额度与功能配置：以完整列表形式管理，保证所有指标/功能都能在表单中编辑
  const [limits, setLimits] = useState<API.PlanLimit[]>([]);
  const [features, setFeatures] = useState<API.PlanFeature[]>([]);
  const { message } = App.useApp();

  // openForm 打开编辑/新建弹窗时初始化额度和功能配置：
  // - 编辑：合并已有配置，未配置的指标默认 0/未启用
  // - 新建：默认全部功能启用，额度为 0（需用户填写）
  const openForm = (record?: API.Plan) => {
    setEditing(record);
    setLimits(
      planMetricOptions.map((opt) => {
        const existing = (record?.limits ?? []).find(
          (l) => Number(l.metric) === opt.value,
        );
        return {
          metric: opt.value,
          limitValue: existing?.limitValue ?? '0',
          period: existing?.period ?? QuotaPeriod.yearly,
        };
      }),
    );
    setFeatures(
      planFeatureOptions.map((opt) => {
        const existing = (record?.features ?? []).find(
          (f) => Number(f.feature) === opt.value,
        );
        return {
          feature: opt.value,
          enabled: record ? existing?.enabled ?? false : true,
        };
      }),
    );
    setFormOpen(true);
  };

  const save = async (values: PlanForm) => {
    // 价格以分（minor units）存储，前端输入元；1 元 = 100 分。
    // 赠送点数以毫点（milli points）存储，前端输入点；1 点 = 1000 毫点。
    // 额度配置：只提交 limitValue > 0 的指标，limitValue=0 视为不配置该额度
    const validLimits = limits
      .filter((l) => Number(l.limitValue) > 0)
      .map((l) => ({
        metric: l.metric,
        limitValue: l.limitValue,
        period: l.period,
      }));
    // 功能配置：全部提交，通过 enabled 区分
    const validFeatures = features.map((f) => ({
      feature: f.feature,
      enabled: f.enabled,
    }));

    const plan: API.Plan = {
      id: editing?.id,
      code: values.code?.trim(),
      name: values.name?.trim(),
      status: values.status,
      description: values.description?.trim() || '',
      halfYearlyPriceMinorUnits: String(
        Math.round((values.halfYearlyPriceYuan ?? 0) * 100),
      ),
      yearlyPriceMinorUnits: String(
        Math.round((values.yearlyPriceYuan ?? 0) * 100),
      ),
      grantedPoints: String(Math.round((values.grantedPoints ?? 0) * 1000)),
      currency: 'CNY',
      billingCycle: values.billingCycle ?? editing?.billingCycle ?? 'yearly',
      visibleToEnterprise: values.visibleToEnterprise ?? true,
      sortOrder: values.sortOrder ?? 0,
      limits: validLimits,
      features: validFeatures,
    };
    if (editing?.id) {
      await planServiceUpdatePlan({ 'plan.id': editing.id }, { plan });
      message.success('套餐已更新');
    } else {
      await planServiceCreatePlan({ plan });
      message.success('套餐已创建');
    }
    setFormOpen(false);
    setEditing(undefined);
    actionRef.current?.reload();
    return true;
  };

  const columns: ProColumns<API.Plan>[] = [
    { title: '套餐名称', dataIndex: 'name', width: 140 },
    { title: '编码', dataIndex: 'code', copyable: true, width: 180 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      valueEnum: optionValueEnum(planStatusOptions),
      render: (_, record) => (
        <Tag color={record.status === PlanStatus.active ? 'success' : 'default'}>
          {optionLabel(planStatusOptions, record.status)}
        </Tag>
      ),
    },
    {
      title: '价格',
      key: 'price',
      search: false,
      width: 140,
      render: (_, record) => renderPrice(record),
    },
    {
      title: '赠送点数',
      dataIndex: 'grantedPoints',
      search: false,
      width: 100,
      render: (_, record) => {
        const v = Number(record.grantedPoints ?? 0);
        return v > 0 ? (
          <span>{(v / 1000).toFixed(1)} 点</span>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        );
      },
    },
    {
      title: '工作台可见',
      dataIndex: 'visibleToEnterprise',
      search: false,
      width: 100,
      render: (_, record) =>
        record.visibleToEnterprise ? (
          <Tag color="blue">可见</Tag>
        ) : (
          <Tag>隐藏</Tag>
        ),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      search: false,
      width: 70,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
      search: false,
      width: 170,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: (_, record) => [
        <Button
          key="detail"
          type="link"
          onClick={() => setDetail(record)}
        >
          查看详情
        </Button>,
        <Button
          key="edit"
          type="link"
          onClick={() => openForm(record)}
        >
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="确认删除套餐？"
          description="已经被企业订阅使用的套餐不能删除。"
          onConfirm={async () => {
            if (!record.id) return;
            await planServiceDeletePlan({ id: record.id });
            message.success('套餐已删除');
            actionRef.current?.reload();
          }}
        >
          <Button type="link" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer title="套餐管理" subTitle="配置企业可购套餐及其定价">
      <ProTable<API.Plan>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        scroll={{ x: 1200 }}
        request={async (params) => {
          const pageSize = params.pageSize ?? 20;
          const reply = await planServiceListPlans({
            pageSize,
            pageToken: pageTokenFor(params.current, pageSize),
            keyword: params.name,
            status: params.status,
          });
          return {
            data: reply.items ?? [],
            total: Number(reply.totalSize ?? 0),
            success: true,
          };
        }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openForm()}
          >
            新建套餐
          </Button>,
        ]}
      />
      <ModalForm<PlanForm>
        title={editing ? '编辑套餐' : '新建套餐'}
        open={formOpen}
        width={760}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setFormOpen(false),
          style: { top: 20, paddingBottom: 80 },
          styles: { body: { maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' } },
        }}
        initialValues={
          editing
            ? {
                code: editing.code,
                name: editing.name,
                status: editing.status,
                description: editing.description,
                halfYearlyPriceYuan:
                  Number(editing.halfYearlyPriceMinorUnits ?? 0) / 100,
                yearlyPriceYuan:
                  Number(editing.yearlyPriceMinorUnits ?? 0) / 100,
                billingCycle: editing.billingCycle ?? 'yearly',
                grantedPoints: Number(editing.grantedPoints ?? 0) / 1000,
                sortOrder: editing.sortOrder ?? 0,
                visibleToEnterprise: editing.visibleToEnterprise ?? true,
              }
            : {
                status: PlanStatus.active,
                billingCycle: 'yearly',
                visibleToEnterprise: true,
                sortOrder: 0,
              }
        }
        onFinish={save}
      >
        <ProForm.Group>
          <ProFormText
            name="code"
            label="套餐编码"
            width="md"
            disabled={Boolean(editing)}
            rules={[{ required: true }]}
          />
          <ProFormText
            name="name"
            label="套餐名称"
            width="md"
            rules={[{ required: true }]}
          />
        </ProForm.Group>
        <ProFormTextArea
          name="description"
          label="套餐描述"
          fieldProps={{ rows: 2, maxLength: 500, showCount: true }}
          placeholder="简要说明套餐适用行业、服务内容等"
        />
        <ProForm.Group>
          <ProFormDigit
            name="halfYearlyPriceYuan"
            label="半年付价格（元）"
            width="sm"
            min={0}
            precision={2}
            fieldProps={{ prefix: '¥' }}
            tooltip="填 0 表示不支持半年付；价格以元为单位，存储时换算为分。"
          />
          <ProFormDigit
            name="yearlyPriceYuan"
            label="年付价格（元）"
            width="sm"
            min={0}
            precision={2}
            fieldProps={{ prefix: '¥' }}
            tooltip="填 0 表示不支持年付；价格以元为单位，存储时换算为分。"
          />
          <ProFormSelect
            name="billingCycle"
            label="计费周期"
            width="sm"
            options={[
              { label: '半年付', value: 'half_yearly' },
              { label: '年付', value: 'yearly' },
            ]}
            tooltip="套餐默认计费周期，决定到期时长。变更仅影响新订阅，不追溯修改已有企业。"
          />
          <ProFormDigit
            name="grantedPoints"
            label="赠送点数（点）"
            width="sm"
            min={0}
            precision={1}
            tooltip="购买套餐时一次性赠送的点数，1 点 = 1000 毫点；填 0 表示不赠送。"
          />
        </ProForm.Group>
        <ProForm.Group>
          <ProFormSelect
            name="status"
            label="状态"
            width="sm"
            options={planStatusOptions}
            rules={[{ required: true }]}
          />
          <ProFormDigit
            name="sortOrder"
            label="排序权重"
            width="sm"
            min={0}
            precision={0}
            tooltip="数字越小越靠前。"
          />
          <ProFormSwitch
            name="visibleToEnterprise"
            label="工作台可见"
            tooltip="关闭后该套餐不会出现在企业工作台的「可购套餐」页面。"
          />
        </ProForm.Group>

        {/* 额度配置：列出所有 10 个指标，每行可填上限值和周期 */}
        <Divider>额度配置</Divider>
        <div className="space-y-3">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            上限值为 0 表示不配置该额度（即不限制对应资源的使用）。
          </Typography.Text>
          {planMetricOptions.map((opt, idx) => {
            const limit = limits[idx];
            return (
              <div
                key={opt.value}
                style={{ display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <span style={{ width: 160, flexShrink: 0 }}>{opt.label}</span>
                <InputNumber
                  value={Number(limit?.limitValue ?? 0)}
                  min={0}
                  precision={0}
                  style={{ flex: 1 }}
                  placeholder="上限值（0 表示不限制）"
                  onChange={(v) => {
                    const next = [...limits];
                    next[idx] = {
                      ...next[idx],
                      limitValue: String(v ?? 0),
                    };
                    setLimits(next);
                  }}
                />
                <Select
                  value={limit?.period ?? QuotaPeriod.yearly}
                  style={{ width: 140 }}
                  options={quotaPeriodOptions}
                  onChange={(v) => {
                    const next = [...limits];
                    next[idx] = { ...next[idx], period: v };
                    setLimits(next);
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* 功能配置：列出所有 5 个功能，每个一个开关 */}
        <Divider>功能配置</Divider>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {planFeatureOptions.map((opt, idx) => {
            const feature = features[idx];
            return (
              <div
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  border: '1px solid #f0f0f0',
                  borderRadius: 6,
                }}
              >
                <Switch
                  checked={feature?.enabled ?? false}
                  onChange={(checked) => {
                    const next = [...features];
                    next[idx] = { ...next[idx], enabled: checked };
                    setFeatures(next);
                  }}
                />
                <span>{opt.label}</span>
              </div>
            );
          })}
        </div>
      </ModalForm>

      {/* 套餐详情弹窗 */}
      <Drawer
        title="套餐详情"
        placement="right"
        width={560}
        open={Boolean(detail)}
        onClose={() => setDetail(undefined)}
        destroyOnClose
      >
        {detail ? (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="套餐名称">
                {detail.name}
              </Descriptions.Item>
              <Descriptions.Item label="套餐编码">
                {detail.code}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag
                  color={
                    detail.status === PlanStatus.active ? 'success' : 'default'
                  }
                >
                  {optionLabel(planStatusOptions, detail.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="套餐描述">
                {detail.description || (
                  <Typography.Text type="secondary">未填写</Typography.Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="价格">
                {renderPrice(detail)}
              </Descriptions.Item>
              <Descriptions.Item label="赠送点数">
                {(() => {
                  const v = Number(detail.grantedPoints ?? 0);
                  return v > 0 ? (
                    <span>{(v / 1000).toFixed(1)} 点</span>
                  ) : (
                    <Typography.Text type="secondary">不赠送</Typography.Text>
                  );
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="工作台可见">
                {detail.visibleToEnterprise ? (
                  <Tag color="blue">可见</Tag>
                ) : (
                  <Tag>隐藏</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="排序权重">
                {detail.sortOrder ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {detail.updatedAt
                  ? new Date(detail.updatedAt).toLocaleString('zh-CN')
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Divider>额度配置</Divider>
            {(detail.limits ?? []).length > 0 ? (
              <Space size={[8, 8]} wrap>
                {detail.limits!.map((limit) => (
                  <Tag key={limit.metric} color="blue">
                    {optionLabel(planMetricOptions, limit.metric)}：
                    {Number(limit.limitValue ?? 0).toLocaleString()} /{' '}
                    {optionLabel(quotaPeriodOptions, limit.period)}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">未配置</Typography.Text>
            )}

            <Divider>功能配置</Divider>
            {(detail.features ?? []).some((f) => f.enabled) ? (
              <Space size={[8, 8]} wrap>
                {detail.features!
                  .filter((f) => f.enabled)
                  .map((f) => (
                    <Tag key={f.feature} color="green">
                      {optionLabel(planFeatureOptions, f.feature)}
                    </Tag>
                  ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">未开通功能</Typography.Text>
            )}
          </>
        ) : null}
      </Drawer>
    </PageContainer>
  );
};

export default PlansPage;
