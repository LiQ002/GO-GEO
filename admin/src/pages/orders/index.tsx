import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProDescriptions,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { App, Button, Descriptions, Drawer, Popconfirm, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  subscriptionOrderServiceAddonQuota,
  subscriptionOrderServiceCancelOrder,
  subscriptionOrderServiceConfirmReceipt,
  subscriptionOrderServiceGetSubscriptionOrder,
  subscriptionOrderServiceListSubscriptionOrders,
  subscriptionOrderServiceOpenPlan,
  subscriptionOrderServiceRechargeCredits,
  subscriptionOrderServiceRefundOrder,
  subscriptionOrderServiceRenewSubscription,
} from '@/services/geo-admin/subscriptionOrderService';
import { planServiceListPlans } from '@/services/geo-admin/planService';
import { pageTokenFor } from '@/utils/admin-api';
import {
  orderCycleOptions,
  orderSourceOptions,
  orderStatusOptions,
  orderStatusTagColor,
  orderTypeOptions,
  PlanStatus,
  quotaMetricApiOptions,
  stringOptionLabel,
  stringOptionValueEnum,
} from '@/utils/platform-enums';

type OpenPlanForm = {
  enterpriseId?: string;
  planId?: string;
  cycle?: string;
  remark?: string;
};

type RenewForm = {
  enterpriseId?: string;
  planId?: string;
  cycle?: string;
  renewFromSubscriptionId?: string;
  remark?: string;
};

type AddonForm = {
  enterpriseId?: string;
  addonQuotaMetric?: string;
  addonQuotaAmount?: number;
  amountMinorUnits?: number;
  remark?: string;
};

type RechargeForm = {
  enterpriseId?: string;
  creditsAmount?: number;
  amountMinorUnits?: number;
  remark?: string;
};

type RemarkForm = {
  remark?: string;
};

const formatYuan = (minorUnits?: string) => {
  if (!minorUnits) return '-';
  const n = Number(minorUnits);
  if (Number.isNaN(n)) return minorUnits;
  return `¥${(n / 100).toFixed(2)}`;
};

const formatPoints = (milliPoints?: string) => {
  if (!milliPoints) return '-';
  const n = Number(milliPoints);
  if (Number.isNaN(n)) return milliPoints;
  return (n / 1000).toFixed(3);
};

const OrdersPage = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [detail, setDetail] = useState<API.SubscriptionOrder>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [openPlanOpen, setOpenPlanOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [addonOpen, setAddonOpen] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<API.SubscriptionOrder>();
  const [cancelTarget, setCancelTarget] = useState<API.SubscriptionOrder>();
  const [refundTarget, setRefundTarget] = useState<API.SubscriptionOrder>();
  const { message } = App.useApp();

  const reloadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      setDetail(
        await subscriptionOrderServiceGetSubscriptionOrder({ id }),
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = async (record: API.SubscriptionOrder) => {
    const id = record.id;
    if (!id) return;
    setDetail(record);
    await reloadDetail(id);
  };

  const refresh = () => {
    actionRef.current?.reload();
    if (detail?.id) reloadDetail(detail.id);
  };

  // 开通套餐
  const submitOpenPlan = async (values: OpenPlanForm) => {
    if (!values.enterpriseId || !values.planId) {
      message.error('请填写企业 ID 和套餐');
      return false;
    }
    await subscriptionOrderServiceOpenPlan({
      enterpriseId: values.enterpriseId,
      planId: values.planId,
      cycle: values.cycle ?? 'yearly',
      remark: values.remark,
    });
    message.success('套餐已开通');
    setOpenPlanOpen(false);
    actionRef.current?.reload();
    return true;
  };

  // 续费
  const submitRenew = async (values: RenewForm) => {
    if (!values.enterpriseId || !values.planId) {
      message.error('请填写企业 ID 和套餐');
      return false;
    }
    await subscriptionOrderServiceRenewSubscription({
      enterpriseId: values.enterpriseId,
      planId: values.planId,
      cycle: values.cycle ?? 'yearly',
      renewFromSubscriptionId: values.renewFromSubscriptionId,
      remark: values.remark,
    });
    message.success('续费订单已创建');
    setRenewOpen(false);
    actionRef.current?.reload();
    return true;
  };

  // 加购额度
  const submitAddon = async (values: AddonForm) => {
    if (!values.enterpriseId || !values.addonQuotaMetric || !values.addonQuotaAmount) {
      message.error('请填写完整加购信息');
      return false;
    }
    const body = {
      enterpriseId: values.enterpriseId,
      addonQuotaMetric: values.addonQuotaMetric,
      addonQuotaAmount: String(values.addonQuotaAmount),
      amountMinorUnits: String((values.amountMinorUnits ?? 0) * 100),
      remark: values.remark,
    };
    await subscriptionOrderServiceAddonQuota(body);
    message.success('加购订单已创建');
    setAddonOpen(false);
    actionRef.current?.reload();
    return true;
  };

  // 充值点数
  const submitRecharge = async (values: RechargeForm) => {
    if (!values.enterpriseId || !values.creditsAmount) {
      message.error('请填写企业 ID 和充值点数');
      return false;
    }
    const body = {
      enterpriseId: values.enterpriseId,
      creditsAmount: String(values.creditsAmount * 1000),
      amountMinorUnits: String((values.amountMinorUnits ?? 0) * 100),
      remark: values.remark,
    };
    await subscriptionOrderServiceRechargeCredits(body);
    message.success('充值订单已创建');
    setRechargeOpen(false);
    actionRef.current?.reload();
    return true;
  };

  // 确认到账
  const submitConfirm = async (values: RemarkForm) => {
    const id = confirmTarget?.id;
    if (!id) return false;
    await subscriptionOrderServiceConfirmReceipt({ id }, { remark: values.remark });
    message.success('订单已确认到账');
    setConfirmTarget(undefined);
    refresh();
    return true;
  };

  // 取消订单
  const submitCancel = async (values: RemarkForm) => {
    const id = cancelTarget?.id;
    if (!id) return false;
    await subscriptionOrderServiceCancelOrder({ id }, { remark: values.remark });
    message.success('订单已取消');
    setCancelTarget(undefined);
    refresh();
    return true;
  };

  // 退款
  const submitRefund = async (values: RemarkForm) => {
    const refId = refundTarget?.id;
    if (!refId) return false;
    await subscriptionOrderServiceRefundOrder({
      refundReferenceOrderId: refId,
      remark: values.remark,
    });
    message.success('退款订单已创建');
    setRefundTarget(undefined);
    refresh();
    return true;
  };

  const planSelectRequest = async () => {
    const reply = await planServiceListPlans({ pageSize: 100, status: PlanStatus.active });
    return (reply.items ?? []).map((plan) => ({ label: plan.name, value: plan.id }));
  };

  const columns: ProColumns<API.SubscriptionOrder>[] = [
    {
      title: '订单号',
      dataIndex: 'keyword',
      fieldProps: { placeholder: '搜索订单号' },
      render: (_, record) => record.orderNo ?? '-',
    },
    {
      title: '类型',
      dataIndex: 'orderType',
      valueType: 'select',
      valueEnum: stringOptionValueEnum(orderTypeOptions),
      render: (_, record) =>
        stringOptionLabel(orderTypeOptions, record.orderType),
    },
    {
      title: '企业名称',
      dataIndex: 'enterpriseName',
      search: false,
      render: (_, record) => record.enterpriseName ?? '-',
    },
    {
      title: '套餐',
      dataIndex: 'planName',
      search: false,
      render: (_, record) => record.planName ?? '-',
    },
    {
      title: '金额',
      dataIndex: 'amountMinorUnits',
      search: false,
      renderText: (value) => formatYuan(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: stringOptionValueEnum(orderStatusOptions),
      render: (_, record) => (
        <Tag color={orderStatusTagColor[record.status ?? ''] ?? 'default'}>
          {stringOptionLabel(orderStatusOptions, record.status)}
        </Tag>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      valueType: 'select',
      valueEnum: stringOptionValueEnum(orderSourceOptions),
      render: (_, record) =>
        stringOptionLabel(orderSourceOptions, record.source),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      search: false,
      renderText: (value) =>
        value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => {
        const actions: ReactNode[] = [
          <Button key="detail" type="link" onClick={() => openDetail(record)}>
            详情
          </Button>,
        ];
        if (record.status === 'pending') {
          actions.push(
            <Button
              key="confirm"
              type="link"
              onClick={() => setConfirmTarget(record)}
            >
              确认到账
            </Button>,
            <Button
              key="cancel"
              type="link"
              danger
              onClick={() => setCancelTarget(record)}
            >
              取消
            </Button>,
          );
        }
        if (
          record.status === 'approved' &&
          record.orderType !== 'refund'
        ) {
          actions.push(
            <Popconfirm
              key="refund"
              title="确认对此订单发起退款？"
              onConfirm={() => setRefundTarget(record)}
            >
              <Button type="link" danger>
                退款
              </Button>
            </Popconfirm>,
          );
        }
        return actions;
      },
    },
  ];

  return (
    <PageContainer title="订单管理" subTitle="套餐开通、续费、加购、充值与退款">
      <ProTable<API.SubscriptionOrder>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const pageSize = params.pageSize ?? 20;
          const reply = await subscriptionOrderServiceListSubscriptionOrders({
            pageSize,
            pageToken: pageTokenFor(params.current, pageSize),
            keyword: params.keyword,
            orderType: params.orderType,
            status: params.status,
            source: params.source,
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
            key="open-plan"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setOpenPlanOpen(true)}
          >
            开通套餐
          </Button>,
          <Button key="renew" onClick={() => setRenewOpen(true)}>
            续费
          </Button>,
          <Button key="addon" onClick={() => setAddonOpen(true)}>
            加购额度
          </Button>,
          <Button key="recharge" onClick={() => setRechargeOpen(true)}>
            充值点数
          </Button>,
        ]}
      />

      {/* 开通套餐 */}
      <ModalForm<OpenPlanForm>
        title="开通套餐"
        width={520}
        open={openPlanOpen}
        modalProps={{ destroyOnHidden: true, onCancel: () => setOpenPlanOpen(false) }}
        onFinish={submitOpenPlan}
        initialValues={{ cycle: 'yearly' }}
      >
        <ProFormText name="enterpriseId" label="企业 ID" rules={[{ required: true }]} />
        <ProFormSelect
          name="planId"
          label="套餐"
          request={planSelectRequest}
          rules={[{ required: true }]}
        />
        <ProFormSelect
          name="cycle"
          label="计费周期"
          options={orderCycleOptions}
          rules={[{ required: true }]}
        />
        <ProFormTextArea name="remark" label="备注" />
      </ModalForm>

      {/* 续费 */}
      <ModalForm<RenewForm>
        title="续费"
        width={520}
        open={renewOpen}
        modalProps={{ destroyOnHidden: true, onCancel: () => setRenewOpen(false) }}
        onFinish={submitRenew}
        initialValues={{ cycle: 'yearly' }}
      >
        <ProFormText name="enterpriseId" label="企业 ID" rules={[{ required: true }]} />
        <ProFormSelect
          name="planId"
          label="套餐"
          request={planSelectRequest}
          rules={[{ required: true }]}
        />
        <ProFormSelect
          name="cycle"
          label="计费周期"
          options={orderCycleOptions}
          rules={[{ required: true }]}
        />
        <ProFormText name="renewFromSubscriptionId" label="原订阅 ID（可选）" />
        <ProFormTextArea name="remark" label="备注" />
      </ModalForm>

      {/* 加购额度 */}
      <ModalForm<AddonForm>
        title="加购额度"
        width={520}
        open={addonOpen}
        modalProps={{ destroyOnHidden: true, onCancel: () => setAddonOpen(false) }}
        onFinish={submitAddon}
      >
        <ProFormText name="enterpriseId" label="企业 ID" rules={[{ required: true }]} />
        <ProFormSelect
          name="addonQuotaMetric"
          label="配额指标"
          options={quotaMetricApiOptions.map((o) => ({ label: o.label, value: o.apiValue }))}
          rules={[{ required: true }]}
        />
        <ProFormDigit
          name="addonQuotaAmount"
          label="加购数量"
          min={1}
          rules={[{ required: true }]}
        />
        <ProFormDigit
          name="amountMinorUnits"
          label="金额（元）"
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormTextArea name="remark" label="备注" />
      </ModalForm>

      {/* 充值点数 */}
      <ModalForm<RechargeForm>
        title="充值点数"
        width={520}
        open={rechargeOpen}
        modalProps={{ destroyOnHidden: true, onCancel: () => setRechargeOpen(false) }}
        onFinish={submitRecharge}
      >
        <ProFormText name="enterpriseId" label="企业 ID" rules={[{ required: true }]} />
        <ProFormDigit
          name="creditsAmount"
          label="充值点数"
          min={1}
          tooltip="1 点 = 1000 毫点"
          rules={[{ required: true }]}
        />
        <ProFormDigit
          name="amountMinorUnits"
          label="金额（元）"
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormTextArea name="remark" label="备注" />
      </ModalForm>

      {/* 确认到账 */}
      <ModalForm<RemarkForm>
        title={`确认到账 · ${confirmTarget?.orderNo ?? ''}`}
        width={480}
        open={Boolean(confirmTarget)}
        modalProps={{ destroyOnHidden: true, onCancel: () => setConfirmTarget(undefined) }}
        onFinish={submitConfirm}
      >
        <ProFormTextArea name="remark" label="备注" rules={[{ required: true, message: '请填写确认备注' }]} />
      </ModalForm>

      {/* 取消订单 */}
      <ModalForm<RemarkForm>
        title={`取消订单 · ${cancelTarget?.orderNo ?? ''}`}
        width={480}
        open={Boolean(cancelTarget)}
        modalProps={{ destroyOnHidden: true, onCancel: () => setCancelTarget(undefined) }}
        onFinish={submitCancel}
      >
        <ProFormTextArea name="remark" label="取消原因" rules={[{ required: true, message: '请填写取消原因' }]} />
      </ModalForm>

      {/* 退款 */}
      <ModalForm<RemarkForm>
        title={`退款 · ${refundTarget?.orderNo ?? ''}`}
        width={480}
        open={Boolean(refundTarget)}
        modalProps={{ destroyOnHidden: true, onCancel: () => setRefundTarget(undefined) }}
        onFinish={submitRefund}
      >
        <ProFormTextArea name="remark" label="退款原因" rules={[{ required: true, message: '请填写退款原因' }]} />
      </ModalForm>

      {/* 详情抽屉 */}
      <Drawer
        title={detail?.orderNo ? `订单详情 · ${detail.orderNo}` : '订单详情'}
        width={720}
        open={Boolean(detail)}
        loading={detailLoading}
        onClose={() => setDetail(undefined)}
        extra={
          <Space>
            {detail?.status === 'pending' && (
              <>
                <Button onClick={() => setConfirmTarget(detail)}>确认到账</Button>
                <Button danger onClick={() => setCancelTarget(detail)}>
                  取消
                </Button>
              </>
            )}
            {detail?.status === 'approved' && detail.orderType !== 'refund' && (
              <Button danger onClick={() => setRefundTarget(detail)}>
                退款
              </Button>
            )}
          </Space>
        }
      >
        <ProDescriptions<API.SubscriptionOrder>
          column={2}
          dataSource={detail}
          columns={[
            { title: '订单号', dataIndex: 'orderNo', copyable: true },
            {
              title: '类型',
              dataIndex: 'orderType',
              renderText: (v) => stringOptionLabel(orderTypeOptions, v),
            },
            { title: '企业名称', dataIndex: 'enterpriseName' },
            { title: '企业 ID', dataIndex: 'enterpriseId' },
            { title: '套餐名', dataIndex: 'planName' },
            { title: '套餐 ID', dataIndex: 'planId' },
            {
              title: '计费周期',
              dataIndex: 'cycle',
              renderText: (v) => stringOptionLabel(orderCycleOptions, v),
            },
            {
              title: '金额',
              dataIndex: 'amountMinorUnits',
              renderText: (v) => formatYuan(v),
            },
            { title: '币种', dataIndex: 'currency' },
            {
              title: '充值点数',
              dataIndex: 'creditsAmount',
              renderText: (v) => formatPoints(v),
            },
            {
              title: '加购指标',
              dataIndex: 'addonQuotaMetric',
            },
            { title: '加购数量', dataIndex: 'addonQuotaAmount' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (_, record) => (
                <Tag color={orderStatusTagColor[record.status ?? ''] ?? 'default'}>
                  {stringOptionLabel(orderStatusOptions, record.status)}
                </Tag>
              ),
            },
            {
              title: '来源',
              dataIndex: 'source',
              renderText: (v) => stringOptionLabel(orderSourceOptions, v),
            },
            {
              title: '支付时间',
              dataIndex: 'paidAt',
              renderText: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
            },
            {
              title: '确认时间',
              dataIndex: 'approvedAt',
              renderText: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
            },
            { title: '确认人', dataIndex: 'approvedBy' },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              renderText: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
            },
            {
              title: '更新时间',
              dataIndex: 'updatedAt',
              renderText: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
            },
          ]}
        />
        {detail?.remark ? (
          <Descriptions title="备注" bordered size="small" style={{ marginTop: 24 }}>
            <Descriptions.Item label="备注内容">{detail.remark}</Descriptions.Item>
          </Descriptions>
        ) : null}
        {(detail?.pointsBefore || detail?.pointsAfter) && (
          <Descriptions title="点数变动" bordered size="small" column={2} style={{ marginTop: 24 }}>
            <Descriptions.Item label="变动前">
              {formatPoints(detail?.pointsBefore)}
            </Descriptions.Item>
            <Descriptions.Item label="变动后">
              {formatPoints(detail?.pointsAfter)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </PageContainer>
  );
};

export default OrdersPage;
