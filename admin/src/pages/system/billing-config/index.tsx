import { ReloadOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ModalForm, PageContainer, ProFormDigit, ProFormSelect, ProFormText, ProTable } from '@ant-design/pro-components';
import { App, Button, Popconfirm, Tag } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  billingConfigServiceGetActionRegistry,
  billingConfigServiceGetBillingUnitCosts,
  billingConfigServiceResetBillingUnitCosts,
  billingConfigServiceUpdateBillingUnitCost,
} from '@/services/geo-admin/billingConfigService';
import {
  chargeTypeOptions,
  stringOptionLabel,
} from '@/utils/platform-enums';

type EditForm = {
  action?: string;
  title?: string;
  points?: number;
  chargeType?: string;
  quotaMetric?: string;
  reason?: string;
};

const BillingConfigPage = () => {
  const actionRef = useRef<any>(null);
  const [items, setItems] = useState<API.BillingUnitCost[]>([]);
  const [registry, setRegistry] = useState<Record<string, API.ActionRegistryEntry>>({});
  const [loading, setLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<API.BillingUnitCost>();
  const { message } = App.useApp();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [costsReply, registryReply] = await Promise.all([
        billingConfigServiceGetBillingUnitCosts(),
        billingConfigServiceGetActionRegistry(),
      ]);
      setItems(costsReply.items ?? []);
      const map: Record<string, API.ActionRegistryEntry> = {};
      (registryReply.items ?? []).forEach((entry) => {
        if (entry.action) map[entry.action] = entry;
      });
      setRegistry(map);
    } catch {
      message.error('计费配置加载失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const submitEdit = async (values: EditForm) => {
    if (!editTarget?.action) return false;
    const isOpenMode = values.chargeType === 'open';
    await billingConfigServiceUpdateBillingUnitCost(
      { action: editTarget.action },
      {
        action: editTarget.action,
        points: isOpenMode ? 0 : values.points,
        chargeType: values.chargeType,
        quotaMetric: isOpenMode ? '' : (values.quotaMetric ?? ''),
        reason: values.reason,
      },
    );
    message.success(`${editTarget.title ?? editTarget.action} 单价已更新`);
    setEditTarget(undefined);
    await loadData();
    return true;
  };

  const resetAll = async () => {
    await billingConfigServiceResetBillingUnitCosts({ reason: '恢复默认单价' });
    message.success('已恢复全部默认单价');
    await loadData();
  };

  const columns: ProColumns<API.BillingUnitCost>[] = [
    {
      title: '计费项',
      dataIndex: 'action',
      search: false,
      width: 180,
      renderText: (v, record) => record.title ?? v,
    },
    {
      title: 'key',
      dataIndex: 'action',
      search: false,
      width: 220,
      renderText: (v) => v,
    },
    {
      title: '点数',
      dataIndex: 'points',
      search: false,
      width: 100,
      renderText: (v) => (v !== undefined ? String(v) : '-'),
    },
    {
      title: '单位',
      dataIndex: 'unit',
      search: false,
      width: 100,
    },
    {
      title: '扣费模式',
      dataIndex: 'chargeType',
      search: false,
      width: 160,
      renderText: (v) => stringOptionLabel(chargeTypeOptions, v),
    },
    {
      title: '额度指标',
      dataIndex: 'quotaMetric',
      search: false,
      width: 160,
      renderText: (v) => v || '-',
    },
    {
      title: '业务状态',
      dataIndex: 'implemented',
      search: false,
      width: 100,
      render: (_, record) => {
        const entry = registry[record.action ?? ''];
        if (!entry) return <Tag>未知</Tag>;
        return entry.implemented ? (
          <Tag color="green">已实现</Tag>
        ) : (
          <Tag color="default">预留</Tag>
        );
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 80,
      render: (_, record) => [
        <Button
          key="edit"
          type="link"
          onClick={() => setEditTarget(record)}
        >
          编辑
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer
      title="计费配置"
      subTitle="12 项计费项点数单价与扣费模式管理"
    >
      <ProTable<API.BillingUnitCost>
        rowKey="action"
        actionRef={actionRef}
        columns={columns}
        loading={loading}
        dataSource={items}
        search={false}
        pagination={false}
        toolBarRender={() => [
          <Popconfirm
            key="reset"
            title="确认恢复全部默认单价？"
            onConfirm={resetAll}
          >
            <Button danger icon={<ReloadOutlined />}>
              恢复默认
            </Button>
          </Popconfirm>,
        ]}
      />

      <ModalForm<EditForm>
        title={`编辑单价 · ${editTarget?.title ?? editTarget?.action ?? ''}`}
        width={520}
        open={Boolean(editTarget)}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setEditTarget(undefined),
        }}
        initialValues={
          editTarget
            ? {
                action: editTarget.action,
                title: editTarget.title,
                points: editTarget.points,
                chargeType: editTarget.chargeType,
                quotaMetric: editTarget.quotaMetric,
              }
            : undefined
        }
        onFinish={submitEdit}
      >
        <ProFormText
          name="title"
          label="计费项"
          disabled
        />
        <ProFormDigit
          name="points"
          label="点数"
          min={0}
          step={0.01}
          fieldProps={{ precision: 2 }}
          tooltip="1 点 = 1000 毫点；0.5 点 = 500 毫点"
          rules={[{ required: true }]}
        />
        <ProFormSelect
          name="chargeType"
          label="扣费模式"
          options={chargeTypeOptions}
          rules={[{ required: true }]}
        />
        <ProFormSelect
          name="quotaMetric"
          label="额度指标"
          allowClear
          options={[
            { label: '词条数 (article_generations)', value: 'article_generations' },
            { label: '发布篇数 (publish_tasks)', value: 'publish_tasks' },
            { label: 'AI蒸馏次数 (ai_distills)', value: 'ai_distills' },
            { label: '品牌关键词 (brand_keywords)', value: 'brand_keywords' },
            { label: '产品关键词 (custom_keywords)', value: 'custom_keywords' },
          ]}
          tooltip="开放模式或只扣点数时可为空"
        />
        <ProFormText
          name="reason"
          label="修改原因"
          rules={[{ required: true, message: '请填写修改原因' }]}
        />
      </ModalForm>
    </PageContainer>
  );
};

export default BillingConfigPage;
