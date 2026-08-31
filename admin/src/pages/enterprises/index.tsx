import { FileSearchOutlined, PlusOutlined } from '@ant-design/icons';
import type {
  ActionType,
  ProColumns,
  ProFormInstance,
} from '@ant-design/pro-components';
import {
  DrawerForm,
  ModalForm,
  PageContainer,
  ProDescriptions,
  ProFormDateTimePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { history, useAccess } from '@umijs/max';
import {
  App,
  Button,
  Descriptions,
  Drawer,
  Popconfirm,
  Space,
  Table,
  Tag,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useRef, useState } from 'react';
import {
  enterpriseServiceChangeEnterpriseStatus,
  enterpriseServiceCreateEnterprise,
  enterpriseServiceGetEnterprise,
  enterpriseServiceListEnterprises,
  enterpriseServiceResetEnterprisePassword,
  enterpriseServiceSetEnterpriseQuota,
  enterpriseServiceSetEnterpriseSubscription,
  enterpriseServiceUpdateEnterprise,
} from '@/services/geo-admin/enterpriseService';
import { planServiceListPlans } from '@/services/geo-admin/planService';
import {
  subscriptionOrderServiceAddonQuota,
  subscriptionOrderServiceOpenPlan,
  subscriptionOrderServiceRechargeCredits,
  subscriptionOrderServiceRenewSubscription,
} from '@/services/geo-admin/subscriptionOrderService';
import { jsonFieldRule, pageTokenFor } from '@/utils/admin-api';
import {
  apiOptionLabel,
  apiOptionValue,
  enterpriseStatusOptions,
  optionValueEnum,
  orderCycleOptions,
  PlanStatus,
  QuotaPeriod,
  quotaMetricApiOptions,
  quotaPeriodApiOptions,
} from '@/utils/platform-enums';

type EnterpriseForm = {
  code?: string;
  name?: string;
  industry?: string;
  region?: string;
  timezone?: string;
  locale?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  remark?: string;
  notificationJson?: string;
  username?: string;
  initialPassword?: string;
  accountEmail?: string;
  accountPhone?: string;
  planId?: string;
  subscriptionExpiresAt?: string;
  // 额外赠送点数（点）；1 点 = 1000 毫点。仅在开通时使用。
  grantedPoints?: number;
  // 编辑时充值点数（点）；提交时调用充值接口。
  rechargePoints?: number;
};

type SubscriptionForm = {
  planId?: string;
  startsAt?: string;
  expiresAt?: string;
  autoRenew?: boolean;
  reason?: string;
};

type QuotaForm = {
  metric?: number;
  limitValue?: number;
  period?: number;
  resetAt?: string;
  reason?: string;
};

type OrderPlanForm = {
  planId?: string;
  cycle?: string;
  remark?: string;
};

type OrderAddonForm = {
  addonQuotaMetric?: string;
  addonQuotaAmount?: number;
  amountMinorUnits?: number;
  remark?: string;
};

type OrderRechargeForm = {
  creditsAmount?: number;
  amountMinorUnits?: number;
  remark?: string;
};

const toISO = (value?: string) =>
  value ? dayjs(value).toISOString() : undefined;

// 计费周期到到期天数的映射。
// 半年付 = 180 天，年付 = 365 天（与后端 billingCycleDuration 保持一致）。
const cycleDays = (cycle?: string): number =>
  cycle === 'half_yearly' ? 180 : 365;

// 以 base 为起点加计费周期，并归一化到到期日北京时间 00:00:00（凌晨零点失效），
// 与后端 beijingMidnight(startsAt + cycleDuration) 保持一致。
const computeExpiresAt = (base: dayjs.Dayjs, cycle?: string): dayjs.Dayjs => {
  return base.add(cycleDays(cycle), 'day').startOf('day');
};

// 计费周期中文标签。
const cycleLabel = (cycle?: string): string => {
  if (cycle === 'half_yearly') return '半年付';
  if (cycle === 'yearly') return '年付';
  return '';
};

const EnterprisesPage = () => {
  const access = useAccess();
  const actionRef = useRef<ActionType | null>(null);
  // DrawerForm 表单实例，用于在套餐 onChange 中 setFieldValue 重算到期时间。
  const formRef = useRef<ProFormInstance | null>(null);
  // 套餐 id → billingCycle 缓存，供套餐 onChange 时按周期推算到期时间。
  const planCycleMapRef = useRef<Map<string, string>>(new Map());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<API.Enterprise>();
  // 编辑时缓存当前订阅信息（仅用于显示当前套餐，修改走"调整套餐"按钮）
  const [editingSubscription, setEditingSubscription] =
    useState<API.Subscription>();
  // 编辑时缓存当前点数余额（毫点），用于只读显示
  const [editingPointsBalance, setEditingPointsBalance] = useState<string>();
  const [detail, setDetail] = useState<API.EnterpriseDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [orderPlanOpen, setOrderPlanOpen] = useState(false);
  const [orderRenewOpen, setOrderRenewOpen] = useState(false);
  const [orderAddonOpen, setOrderAddonOpen] = useState(false);
  const [orderRechargeOpen, setOrderRechargeOpen] = useState(false);
  const { message } = App.useApp();

  const reloadDetail = useCallback(async (enterpriseID: string) => {
    setDetailLoading(true);
    try {
      setDetail(await enterpriseServiceGetEnterprise({ id: enterpriseID }));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = async (record: API.EnterpriseDetail) => {
    const id = record.enterprise?.id;
    if (!id) return;
    setDetail(record);
    await reloadDetail(id);
  };

  const saveEnterprise = async (values: EnterpriseForm) => {
    if (editing?.id) {
      // 编辑企业：先更新企业资料
      await enterpriseServiceUpdateEnterprise(
        { 'enterprise.id': editing.id },
        {
          enterprise: {
            ...editing,
            name: values.name,
            industry: values.industry,
            region: values.region,
            timezone: values.timezone,
            locale: values.locale,
            contactName: values.contactName,
            contactEmail: values.contactEmail,
            contactPhone: values.contactPhone,
            remark: values.remark,
            notificationJson: values.notificationJson,
          },
        },
      );
      // 如套餐或到期时间变更，调用 SetSubscription
      const oldPlanId = editingSubscription?.planId;
      const oldExpiresAt = editingSubscription?.expiresAt;
      const newPlanId = values.planId;
      const newExpiresAt = toISO(values.subscriptionExpiresAt);
      if (
        newPlanId &&
        (newPlanId !== oldPlanId || newExpiresAt !== oldExpiresAt)
      ) {
        await enterpriseServiceSetEnterpriseSubscription(
          { enterpriseId: editing.id },
          {
            enterpriseId: editing.id,
            planId: newPlanId,
            status: 'active',
            startsAt: editingSubscription?.startsAt ?? new Date().toISOString(),
            expiresAt: newExpiresAt ?? dayjs().add(1, 'year').toISOString(),
            autoRenew: editingSubscription?.autoRenew ?? false,
            expectedVersion: editingSubscription?.version ?? '0',
            reason: '编辑企业时调整套餐',
          },
        );
      }
      // 如填了充值点数，调用 RechargeCredits
      if (values.rechargePoints && values.rechargePoints > 0) {
        await subscriptionOrderServiceRechargeCredits({
          enterpriseId: editing.id,
          creditsAmount: String(Math.round(values.rechargePoints * 1000)),
          amountMinorUnits: '0',
          remark: '编辑企业时充值点数',
        });
      }
      message.success('企业资料已更新');
    } else {
      // 开通企业：CreateEnterprise 支持套餐、额外赠送点数
      await enterpriseServiceCreateEnterprise({
        enterprise: {
          code: values.code,
          name: values.name,
          industry: values.industry,
          region: values.region,
          timezone: values.timezone,
          locale: values.locale,
          contactName: values.contactName,
          contactEmail: values.contactEmail,
          contactPhone: values.contactPhone,
          remark: values.remark,
          notificationJson: values.notificationJson,
        },
        username: values.username,
        initialPassword: values.initialPassword,
        accountEmail: values.accountEmail,
        accountPhone: values.accountPhone,
        planId: values.planId,
        subscriptionExpiresAt: toISO(values.subscriptionExpiresAt),
        grantedPoints: String(Math.round((values.grantedPoints ?? 0) * 1000)),
      });
      message.success('企业和单一登录账号已创建');
    }
    setFormOpen(false);
    setEditing(undefined);
    setEditingSubscription(undefined);
    setEditingPointsBalance(undefined);
    actionRef.current?.reload();
    return true;
  };

  const changeStatus = async (record: API.EnterpriseDetail) => {
    const enterprise = record.enterprise;
    if (!enterprise?.id || !enterprise.version) return;
    const action = enterprise.status === 'active' ? 'suspend' : 'activate';
    await enterpriseServiceChangeEnterpriseStatus(
      { id: enterprise.id },
      {
        id: enterprise.id,
        version: enterprise.version,
        action,
        reason:
          action === 'suspend'
            ? '运营人员暂停企业服务'
            : '运营人员恢复企业服务',
      },
    );
    message.success(action === 'suspend' ? '企业已暂停' : '企业已恢复');
    actionRef.current?.reload();
    if (detail?.enterprise?.id === enterprise.id)
      await reloadDetail(enterprise.id);
  };

  const columns: ProColumns<API.EnterpriseDetail>[] = [
    {
      title: '企业',
      dataIndex: 'keyword',
      render: (_, record) => (
        <Button type="link" onClick={() => openDetail(record)}>
          {record.enterprise?.name}
        </Button>
      ),
    },
    {
      title: '企业 ID',
      dataIndex: 'enterpriseId',
      search: false,
      renderText: (_, record) => record.enterprise?.id ?? '-',
    },
    {
      title: '企业编码',
      dataIndex: 'code',
      search: false,
      renderText: (_, record) => record.enterprise?.code,
    },
    {
      title: '账号',
      dataIndex: 'username',
      search: false,
      renderText: (_, record) => record.account?.username,
    },
    {
      title: '套餐',
      dataIndex: 'planId',
      valueType: 'select',
      request: async () => {
        const reply = await planServiceListPlans({
          pageSize: 100,
          status: PlanStatus.active,
        });
        return (reply.items ?? []).map((plan) => ({
          label: plan.name,
          value: plan.id,
        }));
      },
      renderText: (_, record) => record.subscription?.planName ?? '未配置',
    },
    {
      title: '到期时间',
      dataIndex: 'expiresAt',
      valueType: 'dateTime',
      search: false,
      renderText: (_, record) => record.subscription?.expiresAt ?? '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: optionValueEnum(enterpriseStatusOptions),
      render: (_, record) => (
        <Tag
          color={record.enterprise?.status === 'active' ? 'success' : 'warning'}
        >
          {apiOptionLabel(enterpriseStatusOptions, record.enterprise?.status)}
        </Tag>
      ),
    },
    {
      title: '联系人',
      dataIndex: 'contact',
      search: false,
      renderText: (_, record) =>
        record.enterprise?.contactName ||
        record.enterprise?.contactPhone ||
        '-',
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => [
        <Button key="detail" type="link" onClick={() => openDetail(record)}>
          详情
        </Button>,
        <Button
          key="edit"
          type="link"
          onClick={() => {
            setEditing(record.enterprise);
            setEditingSubscription(record.subscription);
            setEditingPointsBalance(record.pointsBalance);
            setFormOpen(true);
          }}
        >
          编辑
        </Button>,
        <Popconfirm
          key="status"
          title={
            record.enterprise?.status === 'active'
              ? '确认暂停企业？'
              : '确认恢复企业？'
          }
          description="暂停后企业账号现有会话会立即失效。"
          onConfirm={() => changeStatus(record)}
        >
          <Button type="link" danger={record.enterprise?.status === 'active'}>
            {record.enterprise?.status === 'active' ? '暂停' : '恢复'}
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer
      title="企业管理"
      subTitle="开通企业单账号、套餐、有效期和配额"
    >
      <ProTable<API.EnterpriseDetail>
        rowKey={(record) => record.enterprise?.id ?? ''}
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const pageSize = params.pageSize ?? 20;
          const reply = await enterpriseServiceListEnterprises({
            pageSize,
            pageToken: pageTokenFor(params.current, pageSize),
            keyword: params.keyword,
            status: apiOptionValue(enterpriseStatusOptions, params.status),
            planId: params.planId,
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
            onClick={() => {
              setEditing(undefined);
              setEditingSubscription(undefined);
              setEditingPointsBalance(undefined);
              setFormOpen(true);
            }}
          >
            开通企业
          </Button>,
        ]}
      />

      <DrawerForm<EnterpriseForm>
        title={editing ? '编辑企业资料' : '开通企业'}
        open={formOpen}
        width={640}
        formRef={formRef as any}
        drawerProps={{
          destroyOnHidden: true,
          onClose: () => setFormOpen(false),
        }}
        initialValues={
          editing ?? {
            timezone: 'Asia/Shanghai',
            locale: 'zh-CN',
            notificationJson: '{}',
            subscriptionExpiresAt: dayjs().add(1, 'year').toISOString(),
          }
        }
        onFinish={saveEnterprise}
      >
        <ProFormText
          name="code"
          label="企业编码"
          disabled={Boolean(editing)}
          rules={[{ required: true }]}
        />
        <ProFormText
          name="name"
          label="企业名称"
          rules={[{ required: true }]}
        />
        <ProFormText name="industry" label="行业" />
        <ProFormText name="region" label="地区" />
        <ProFormText
          name="timezone"
          label="时区"
          rules={[{ required: true }]}
        />
        <ProFormText name="locale" label="语言" rules={[{ required: true }]} />
        <ProFormText name="contactName" label="联系人" />
        <ProFormText name="contactEmail" label="联系邮箱" />
        <ProFormText name="contactPhone" label="联系电话" />
        <ProFormTextArea
          name="notificationJson"
          label="通知配置 JSON"
          rules={[jsonFieldRule()]}
        />
        <ProFormTextArea name="remark" label="运营备注" />
        {!editing ? (
          <>
            <ProFormText
              name="username"
              label="登录用户名"
              rules={[{ required: true }]}
            />
            <ProFormText.Password
              name="initialPassword"
              label="初始密码"
              rules={[
                { required: true, message: '请输入初始密码' },
                { min: 10, message: '密码至少需要 10 个字符' },
                {
                  pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/u,
                  message: '密码必须同时包含字母和数字',
                },
              ]}
            />
            <ProFormText name="accountEmail" label="账号邮箱" />
            <ProFormText name="accountPhone" label="账号手机" />
            <ProFormSelect
              name="planId"
              label="套餐"
              tooltip="选择套餐后将根据计费周期（半年付=180天，年付=365天）自动推算到期时间。到期时间统一为到期日北京时间 00:00:00（凌晨零点失效），不可手动修改。"
              request={async () => {
                const reply = await planServiceListPlans({
                  pageSize: 100,
                  status: PlanStatus.active,
                });
                const items = reply.items ?? [];
                const map = planCycleMapRef.current;
                map.clear();
                items.forEach((plan) => {
                  if (plan.id) {
                    map.set(String(plan.id), plan.billingCycle ?? 'yearly');
                  }
                });
                return items.map((plan) => {
                  const tag = cycleLabel(plan.billingCycle);
                  return {
                    label: tag ? `${plan.name}（${tag}）` : plan.name,
                    value: plan.id,
                  };
                });
              }}
              fieldProps={{
                onChange: (value: string) => {
                  const cycle = planCycleMapRef.current.get(String(value));
                  formRef.current?.setFieldValue(
                    'subscriptionExpiresAt',
                    computeExpiresAt(dayjs(), cycle).toISOString(),
                  );
                },
              }}
            />
            <ProFormDateTimePicker
              name="subscriptionExpiresAt"
              label="套餐到期时间（自动）"
              tooltip="根据所选套餐计费周期自动推算，统一为到期日北京时间 00:00:00，不可手动修改。"
              fieldProps={{ disabled: true }}
            />
            <ProFormDigit
              name="grantedPoints"
              label="额外赠送点数"
              min={0}
              precision={2}
              fieldProps={{ step: 0.5 }}
              tooltip="套餐自带的赠送点数会自动发放；此处可额外赠送。单位：点（1 点 = 1000 毫点）。"
              placeholder="如 100.50"
            />
          </>
        ) : (
          <>
            <ProFormSelect
              name="planId"
              label="当前套餐"
              tooltip="修改后将调用「调整套餐」接口，会同步套餐额度配置。切换套餐后新订阅从换套餐当下起按新周期重新计费，到期时间统一为到期日北京时间 00:00:00，不可手动修改。"
              request={async () => {
                const reply = await planServiceListPlans({
                  pageSize: 100,
                  status: PlanStatus.active,
                });
                const items = reply.items ?? [];
                // 同步刷新 planId → billingCycle 缓存。
                const map = planCycleMapRef.current;
                map.clear();
                items.forEach((plan) => {
                  if (plan.id)
                    map.set(String(plan.id), plan.billingCycle ?? 'yearly');
                });
                return items.map((plan) => {
                  const tag = cycleLabel(plan.billingCycle);
                  return {
                    label: tag ? `${plan.name}（${tag}）` : plan.name,
                    value: plan.id,
                  };
                });
              }}
              initialValue={editingSubscription?.planId}
              fieldProps={{
                onChange: (value: string) => {
                  const cycle = planCycleMapRef.current.get(String(value));
                  // 切换套餐：从换套餐当下起算，按新周期重新推算到期时间。
                  formRef.current?.setFieldValue(
                    'subscriptionExpiresAt',
                    computeExpiresAt(dayjs(), cycle).toISOString(),
                  );
                },
              }}
            />
            <ProFormDateTimePicker
              name="subscriptionExpiresAt"
              label="套餐到期时间（自动）"
              tooltip="根据所选套餐计费周期自动推算，统一为到期日北京时间 00:00:00，不可手动修改。"
              fieldProps={{ disabled: true }}
              initialValue={
                editingSubscription?.expiresAt
                  ? dayjs(editingSubscription.expiresAt).toISOString()
                  : dayjs().add(1, 'year').toISOString()
              }
            />
            <ProFormDigit
              name="rechargePoints"
              label="充值点数"
              min={0}
              precision={2}
              fieldProps={{ step: 0.5 }}
              tooltip="提交时调用充值接口给该企业加点数。当前点数余额见下方只读字段。留空或 0 表示不充值。"
              placeholder="如 100.50"
            />
            <ProFormText
              name="pointsBalanceDisplay"
              label="当前点数余额"
              disabled
              initialValue={
                editingPointsBalance
                  ? `${(Number(editingPointsBalance) / 1000).toFixed(2)} 点`
                  : '0 点'
              }
            />
          </>
        )}
      </DrawerForm>

      <Drawer
        title={detail?.enterprise?.name ?? '企业详情'}
        width={760}
        open={Boolean(detail)}
        loading={detailLoading}
        onClose={() => setDetail(undefined)}
        extra={
          <Space wrap>
            {access.canSalesOpportunityRead && detail?.enterprise?.id && (
              <Button
                icon={<FileSearchOutlined />}
                onClick={() =>
                  history.push(
                    `/sales/diagnoses/new?enterpriseId=${detail.enterprise?.id}`,
                  )
                }
              >
                发起诊断
              </Button>
            )}
            <Button type="primary" onClick={() => setOrderPlanOpen(true)}>
              开通套餐
            </Button>
            <Button onClick={() => setOrderRenewOpen(true)}>续费</Button>
            <Button onClick={() => setOrderAddonOpen(true)}>加购额度</Button>
            <Button onClick={() => setOrderRechargeOpen(true)}>充值点数</Button>
            <Button onClick={() => setSubscriptionOpen(true)}>调整套餐</Button>
            <Button onClick={() => setQuotaOpen(true)}>调整配额</Button>
            <Button danger onClick={() => setPasswordOpen(true)}>
              重置密码
            </Button>
          </Space>
        }
      >
        <ProDescriptions<API.Enterprise>
          title="企业资料"
          dataSource={detail?.enterprise}
          columns={[
            { title: '编码', dataIndex: 'code' },
            { title: '状态', dataIndex: 'status' },
            { title: '行业', dataIndex: 'industry' },
            { title: '地区', dataIndex: 'region' },
            { title: '联系人', dataIndex: 'contactName' },
            { title: '联系电话', dataIndex: 'contactPhone' },
            { title: '联系邮箱', dataIndex: 'contactEmail' },
            {
              title: '代理商归属',
              dataIndex: 'agentId',
              renderText: (value) => value || '未分配（预留）',
            },
          ]}
        />
        <Descriptions title="登录账号" column={2} bordered size="small">
          <Descriptions.Item label="用户名">
            {detail?.account?.username}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {detail?.account?.status}
          </Descriptions.Item>
          <Descriptions.Item label="强制改密">
            {detail?.account?.mustChangePassword ? '是' : '否'}
          </Descriptions.Item>
          <Descriptions.Item label="最近登录">
            {detail?.account?.lastLoginAt ?? '-'}
          </Descriptions.Item>
        </Descriptions>
        <Descriptions
          title="订阅"
          column={2}
          bordered
          size="small"
          style={{ marginTop: 24 }}
        >
          <Descriptions.Item label="套餐">
            {detail?.subscription?.planName ?? '未配置'}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {detail?.subscription?.status ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="开始">
            {detail?.subscription?.startsAt ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="到期">
            {detail?.subscription?.expiresAt ?? '-'}
          </Descriptions.Item>
        </Descriptions>
        <Table<API.QuotaLimit>
          rowKey="metric"
          style={{ marginTop: 24 }}
          pagination={false}
          dataSource={detail?.quotas ?? []}
          columns={[
            { title: '指标', dataIndex: 'metric' },
            { title: '额度', dataIndex: 'limitValue' },
            { title: '已用', dataIndex: 'usedValue' },
            { title: '预占', dataIndex: 'reservedValue' },
            { title: '周期', dataIndex: 'period' },
          ]}
        />
      </Drawer>

      <ModalForm<SubscriptionForm>
        title="调整企业套餐"
        open={subscriptionOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setSubscriptionOpen(false),
        }}
        initialValues={{
          planId: detail?.subscription?.planId,
          startsAt: detail?.subscription?.startsAt ?? dayjs().toISOString(),
          expiresAt:
            detail?.subscription?.expiresAt ??
            dayjs().add(1, 'year').toISOString(),
          autoRenew: detail?.subscription?.autoRenew,
        }}
        onFinish={async (values) => {
          const id = detail?.enterprise?.id;
          if (!id) return false;
          await enterpriseServiceSetEnterpriseSubscription(
            { enterpriseId: id },
            {
              enterpriseId: id,
              planId: values.planId,
              status: 'active',
              startsAt: toISO(values.startsAt),
              expiresAt: toISO(values.expiresAt),
              autoRenew: values.autoRenew,
              expectedVersion: detail?.subscription?.version,
              reason: values.reason,
            },
          );
          message.success('企业套餐已更新');
          setSubscriptionOpen(false);
          await reloadDetail(id);
          actionRef.current?.reload();
          return true;
        }}
      >
        <ProFormSelect
          name="planId"
          label="套餐"
          request={async () => {
            const reply = await planServiceListPlans({
              pageSize: 100,
              status: PlanStatus.active,
            });
            return (reply.items ?? []).map((plan) => ({
              label: plan.name,
              value: plan.id,
            }));
          }}
          rules={[{ required: true }]}
        />
        <ProFormDateTimePicker
          name="startsAt"
          label="开始时间"
          rules={[{ required: true }]}
        />
        <ProFormDateTimePicker
          name="expiresAt"
          label="到期时间"
          rules={[{ required: true }]}
        />
        <ProFormSwitch name="autoRenew" label="自动续期" />
        <ProFormTextArea
          name="reason"
          label="调整原因"
          rules={[{ required: true }]}
        />
      </ModalForm>

      <ModalForm<QuotaForm>
        title="调整企业配额"
        open={quotaOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setQuotaOpen(false),
        }}
        initialValues={{ period: QuotaPeriod.monthly }}
        onFinish={async (values) => {
          const id = detail?.enterprise?.id;
          const metric = apiOptionValue(quotaMetricApiOptions, values.metric);
          const period = apiOptionValue(quotaPeriodApiOptions, values.period);
          if (!id || !metric) return false;
          await enterpriseServiceSetEnterpriseQuota(
            { enterpriseId: id, metric },
            {
              enterpriseId: id,
              metric,
              limitValue: String(values.limitValue ?? 0),
              period,
              resetAt: toISO(values.resetAt),
              reason: values.reason,
            },
          );
          message.success('企业配额已更新');
          setQuotaOpen(false);
          await reloadDetail(id);
          return true;
        }}
      >
        <ProFormSelect
          name="metric"
          label="配额指标"
          options={quotaMetricApiOptions}
          rules={[{ required: true }]}
        />
        <ProFormDigit
          name="limitValue"
          label="额度"
          min={0}
          rules={[{ required: true }]}
        />
        <ProFormSelect
          name="period"
          label="周期"
          options={quotaPeriodApiOptions}
        />
        <ProFormDateTimePicker name="resetAt" label="下次重置时间" />
        <ProFormTextArea
          name="reason"
          label="调整原因"
          rules={[{ required: true }]}
        />
      </ModalForm>

      <ModalForm<{ newPassword?: string; reason?: string }>
        title="重置企业密码"
        open={passwordOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setPasswordOpen(false),
        }}
        onFinish={async (values) => {
          const id = detail?.enterprise?.id;
          if (!id) return false;
          await enterpriseServiceResetEnterprisePassword(
            { id },
            { id, newPassword: values.newPassword, reason: values.reason },
          );
          message.success('密码已重置，企业下次登录必须修改密码');
          setPasswordOpen(false);
          await reloadDetail(id);
          return true;
        }}
      >
        <ProFormText.Password
          name="newPassword"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 10, message: '密码至少需要 10 个字符' },
            {
              pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/u,
              message: '密码必须同时包含字母和数字',
            },
          ]}
        />
        <ProFormTextArea
          name="reason"
          label="重置原因"
          rules={[{ required: true }]}
        />
      </ModalForm>

      {/* 开通套餐（订单） */}
      <ModalForm<OrderPlanForm>
        title={`开通套餐 · ${detail?.enterprise?.name ?? ''}`}
        width={520}
        open={orderPlanOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setOrderPlanOpen(false),
        }}
        initialValues={{ cycle: 'yearly' }}
        onFinish={async (values) => {
          const id = detail?.enterprise?.id;
          if (!id || !values.planId) {
            message.error('请选择套餐');
            return false;
          }
          await subscriptionOrderServiceOpenPlan({
            enterpriseId: id,
            planId: values.planId,
            cycle: values.cycle ?? 'yearly',
            remark: values.remark,
          });
          message.success('开通订单已创建（已直接生效）');
          setOrderPlanOpen(false);
          await reloadDetail(id);
          actionRef.current?.reload();
          return true;
        }}
      >
        <ProFormSelect
          name="planId"
          label="套餐"
          request={async () => {
            const reply = await planServiceListPlans({
              pageSize: 100,
              status: PlanStatus.active,
            });
            return (reply.items ?? []).map((plan) => ({
              label: plan.name,
              value: plan.id,
            }));
          }}
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

      {/* 续费（订单） */}
      <ModalForm<OrderPlanForm>
        title={`续费 · ${detail?.enterprise?.name ?? ''}`}
        width={520}
        open={orderRenewOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setOrderRenewOpen(false),
        }}
        initialValues={{ cycle: 'yearly' }}
        onFinish={async (values) => {
          const id = detail?.enterprise?.id;
          if (!id || !values.planId) {
            message.error('请选择套餐');
            return false;
          }
          await subscriptionOrderServiceRenewSubscription({
            enterpriseId: id,
            planId: values.planId,
            cycle: values.cycle ?? 'yearly',
            remark: values.remark,
          });
          message.success('续费订单已创建（已直接生效）');
          setOrderRenewOpen(false);
          await reloadDetail(id);
          actionRef.current?.reload();
          return true;
        }}
      >
        <ProFormSelect
          name="planId"
          label="套餐"
          request={async () => {
            const reply = await planServiceListPlans({
              pageSize: 100,
              status: PlanStatus.active,
            });
            return (reply.items ?? []).map((plan) => ({
              label: plan.name,
              value: plan.id,
            }));
          }}
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

      {/* 加购额度（订单） */}
      <ModalForm<OrderAddonForm>
        title={`加购额度 · ${detail?.enterprise?.name ?? ''}`}
        width={520}
        open={orderAddonOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setOrderAddonOpen(false),
        }}
        onFinish={async (values) => {
          const id = detail?.enterprise?.id;
          if (!id || !values.addonQuotaMetric || !values.addonQuotaAmount) {
            message.error('请填写完整加购信息');
            return false;
          }
          await subscriptionOrderServiceAddonQuota({
            enterpriseId: id,
            addonQuotaMetric: values.addonQuotaMetric,
            addonQuotaAmount: String(values.addonQuotaAmount),
            amountMinorUnits: String((values.amountMinorUnits ?? 0) * 100),
            remark: values.remark,
          });
          message.success('加购订单已创建（已直接生效）');
          setOrderAddonOpen(false);
          await reloadDetail(id);
          actionRef.current?.reload();
          return true;
        }}
      >
        <ProFormSelect
          name="addonQuotaMetric"
          label="配额指标"
          options={quotaMetricApiOptions.map((o) => ({
            label: o.label,
            value: o.apiValue,
          }))}
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

      {/* 充值点数（订单） */}
      <ModalForm<OrderRechargeForm>
        title={`充值点数 · ${detail?.enterprise?.name ?? ''}`}
        width={520}
        open={orderRechargeOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setOrderRechargeOpen(false),
        }}
        onFinish={async (values) => {
          const id = detail?.enterprise?.id;
          if (!id || !values.creditsAmount) {
            message.error('请填写充值点数');
            return false;
          }
          await subscriptionOrderServiceRechargeCredits({
            enterpriseId: id,
            creditsAmount: String(values.creditsAmount * 1000),
            amountMinorUnits: String((values.amountMinorUnits ?? 0) * 100),
            remark: values.remark,
          });
          message.success('充值订单已创建（已直接生效）');
          setOrderRechargeOpen(false);
          await reloadDetail(id);
          actionRef.current?.reload();
          return true;
        }}
      >
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
    </PageContainer>
  );
};

export default EnterprisesPage;
