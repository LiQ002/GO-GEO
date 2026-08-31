import {
  EditOutlined,
  FileSearchOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  DrawerForm,
  ModalForm,
  PageContainer,
  ProForm,
  ProFormDigit,
  ProFormList,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { history, useAccess } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  salesOpportunityServiceChangeSalesOpportunityStatus,
  salesOpportunityServiceCheckSalesOpportunityDuplicate,
  salesOpportunityServiceCreateSalesOpportunity,
  salesOpportunityServiceGetSalesOpportunity,
  salesOpportunityServiceListSalesOpportunities,
  salesOpportunityServiceListSalesOpportunityOwners,
  salesOpportunityServiceUpdateSalesOpportunity,
} from '@/services/geo-admin/salesOpportunityService';
import { pageTokenFor } from '@/utils/admin-api';
import {
  SalesOpportunityStatus,
  salesOpportunityStatusColors,
  salesOpportunityStatusLabel,
  salesOpportunityStatusValueEnum,
} from '@/utils/sales-enums';

type OpportunityForm = Omit<
  API.SalesOpportunity,
  'brandAliases' | 'budgetMinMinorUnits' | 'budgetMaxMinorUnits'
> & {
  brandAliasValues?: string[];
  budgetMinYuan?: number;
  budgetMaxYuan?: number;
};

type StatusForm = { reason: string };

type StatusAction = {
  opportunity: API.SalesOpportunity;
  status: number;
  title: string;
};

const amountToYuan = (value?: string) => {
  if (!value) return undefined;
  return Number(value) / 100;
};

const amountToMinorUnits = (value?: number) =>
  String(Math.round((value ?? 0) * 100));

const formValues = (item?: API.SalesOpportunity): OpportunityForm => {
  const { brandAliases, budgetMaxMinorUnits, budgetMinMinorUnits, ...values } =
    item ?? {};
  return {
    ...values,
    currency: item?.currency ?? 'CNY',
    budgetMinYuan: amountToYuan(budgetMinMinorUnits),
    budgetMaxYuan: amountToYuan(budgetMaxMinorUnits),
    brandAliasValues: (brandAliases ?? []).flatMap((item) =>
      item.alias ? [item.alias] : [],
    ),
    products: item?.products ?? [],
    competitors: item?.competitors ?? [],
  };
};

const opportunityPayload = (
  values: OpportunityForm,
  existing?: API.SalesOpportunity,
): API.SalesOpportunity => {
  const { brandAliasValues, budgetMaxYuan, budgetMinYuan, ...opportunity } =
    values;
  return {
    ...(existing ?? {}),
    ...opportunity,
    budgetMinMinorUnits: amountToMinorUnits(budgetMinYuan),
    budgetMaxMinorUnits: amountToMinorUnits(budgetMaxYuan),
    currency: values.currency ?? 'CNY',
    brandAliases: (brandAliasValues ?? []).map((alias, index) => ({
      alias,
      sortOrder: index,
    })),
    products: values.products ?? [],
    competitors: values.competitors ?? [],
  };
};

export default function SalesOpportunitiesPage() {
  const actionRef = useRef<ActionType | null>(null);
  const access = useAccess();
  const { message, modal } = App.useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<API.SalesOpportunity>();
  const [detail, setDetail] = useState<API.SalesOpportunity>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [owners, setOwners] = useState<API.SalesOpportunityOwner[]>([]);
  const [canAssignOthers, setCanAssignOthers] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<
    API.SalesOpportunity[]
  >([]);
  const [statusAction, setStatusAction] = useState<StatusAction>();

  useEffect(() => {
    void salesOpportunityServiceListSalesOpportunityOwners({}).then((reply) => {
      setOwners(reply.items ?? []);
      setCanAssignOthers(Boolean(reply.canAssignOthers));
    });
  }, []);

  const ownerOptions = useMemo(
    () =>
      owners.flatMap((owner) =>
        owner.id
          ? [
              {
                label: owner.displayName
                  ? `${owner.displayName}（${owner.username ?? owner.id}）`
                  : (owner.username ?? owner.id),
                value: owner.id,
              },
            ]
          : [],
      ),
    [owners],
  );

  const checkDuplicate = async (values: OpportunityForm) => {
    if (!values.customerName?.trim() && !values.website?.trim()) {
      setDuplicateMatches([]);
      return [];
    }
    const reply = await salesOpportunityServiceCheckSalesOpportunityDuplicate({
      customerName: values.customerName?.trim(),
      website: values.website?.trim(),
      excludeId: editing?.id,
    });
    const matches = reply.matches ?? [];
    setDuplicateMatches(matches);
    return matches;
  };

  const openEdit = async (record: API.SalesOpportunity) => {
    if (!record.id) return;
    const item = await salesOpportunityServiceGetSalesOpportunity({
      id: record.id,
    });
    setDetail(undefined);
    setEditing(item);
    setDuplicateMatches([]);
    setFormOpen(true);
  };

  const openDetail = async (record: API.SalesOpportunity) => {
    if (!record.id) return;
    setDetail(record);
    setDetailLoading(true);
    try {
      setDetail(
        await salesOpportunityServiceGetSalesOpportunity({ id: record.id }),
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const saveOpportunity = async (values: OpportunityForm) => {
    const matches = await checkDuplicate(values);
    if (matches.length > 0) {
      const confirmed = await modal.confirm({
        title: '发现疑似重复客户',
        content: `已有 ${matches.length} 条销售机会使用相同企业名称或官网，是否仍要保存？`,
        okText: '仍然保存',
        cancelText: '返回核对',
      });
      if (!confirmed) return false;
    }
    const payload = opportunityPayload(values, editing);
    if (editing?.id) {
      await salesOpportunityServiceUpdateSalesOpportunity(
        { 'opportunity.id': editing.id },
        { opportunity: payload },
      );
      message.success('销售机会和客户资料已更新');
    } else {
      await salesOpportunityServiceCreateSalesOpportunity({
        opportunity: payload,
      });
      message.success('销售机会已创建');
    }
    setFormOpen(false);
    setEditing(undefined);
    setDuplicateMatches([]);
    actionRef.current?.reload();
    return true;
  };

  const columns: ProColumns<API.SalesOpportunity>[] = [
    {
      title: '机会/客户',
      dataIndex: 'keyword',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            style={{ padding: 0 }}
            onClick={() => openDetail(record)}
          >
            {record.name}
          </Button>
          <Typography.Text type="secondary">
            {record.customerName} · {record.brandName}
          </Typography.Text>
        </Space>
      ),
    },
    { title: '机会编号', dataIndex: 'code', search: false, width: 170 },
    {
      title: '负责人',
      dataIndex: 'ownerAdminId',
      valueType: 'select',
      fieldProps: { options: ownerOptions, showSearch: true },
      renderText: (_, record) => record.ownerDisplayName ?? '-',
      search: canAssignOthers ? undefined : false,
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: salesOpportunityStatusValueEnum(),
      render: (_, record) => (
        <Tag color={salesOpportunityStatusColors[record.status ?? 0]}>
          {salesOpportunityStatusLabel(record.status)}
        </Tag>
      ),
      width: 100,
    },
    { title: '行业', dataIndex: 'industry', search: false, width: 120 },
    { title: '地区', dataIndex: 'region', search: false, width: 120 },
    {
      title: '联系人',
      search: false,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.contactName || '-'}</span>
          <Typography.Text type="secondary">
            {record.contactPhone || record.contactEmail || '-'}
          </Typography.Text>
        </Space>
      ),
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
      fixed: 'right',
      width: 250,
      render: (_, record) => {
        const actions = [
          <Button key="detail" type="link" onClick={() => openDetail(record)}>
            详情
          </Button>,
        ];
        if (access.canSalesOpportunityManage) {
          actions.push(
            <Button key="edit" type="link" onClick={() => openEdit(record)}>
              编辑
            </Button>,
          );
          if (record.status === SalesOpportunityStatus.following) {
            actions.push(
              <Button
                key="pause"
                type="link"
                onClick={() =>
                  setStatusAction({
                    opportunity: record,
                    status: SalesOpportunityStatus.paused,
                    title: '暂停销售机会',
                  })
                }
              >
                暂停
              </Button>,
            );
          } else if (record.status === SalesOpportunityStatus.paused) {
            actions.push(
              <Button
                key="resume"
                type="link"
                onClick={() =>
                  setStatusAction({
                    opportunity: record,
                    status: SalesOpportunityStatus.following,
                    title: '恢复销售机会',
                  })
                }
              >
                恢复
              </Button>,
            );
          }
          if (record.status !== SalesOpportunityStatus.closed) {
            actions.push(
              <Button
                key="close"
                type="link"
                danger
                onClick={() =>
                  setStatusAction({
                    opportunity: record,
                    status: SalesOpportunityStatus.closed,
                    title: '关闭销售机会',
                  })
                }
              >
                关闭
              </Button>,
            );
          }
        }
        return actions;
      },
    },
  ];

  return (
    <PageContainer
      title="销售机会"
      subTitle="统一维护售前客户资料，为后续多次诊断和报告生成提供数据来源"
    >
      <ProTable<API.SalesOpportunity>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        scroll={{ x: 1300 }}
        request={async (params) => {
          const pageSize = params.pageSize ?? 20;
          const reply = await salesOpportunityServiceListSalesOpportunities({
            pageSize,
            pageToken: pageTokenFor(params.current, pageSize),
            keyword: params.keyword,
            status: params.status,
            ownerAdminId: params.ownerAdminId,
          });
          return {
            data: reply.items ?? [],
            total: Number(reply.totalSize ?? 0),
            success: true,
          };
        }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        toolBarRender={() =>
          access.canSalesOpportunityManage
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditing(undefined);
                    setDuplicateMatches([]);
                    setFormOpen(true);
                  }}
                >
                  新建销售机会
                </Button>,
              ]
            : []
        }
      />

      <DrawerForm<OpportunityForm>
        title={editing ? '编辑销售机会和客户资料' : '新建销售机会'}
        open={formOpen}
        width="min(1040px, 96vw)"
        drawerProps={{
          destroyOnHidden: true,
          onClose: () => {
            setFormOpen(false);
            setEditing(undefined);
            setDuplicateMatches([]);
          },
        }}
        initialValues={formValues(editing)}
        onFinish={saveOpportunity}
      >
        {duplicateMatches.length > 0 && (
          <Alert
            showIcon
            type="warning"
            title={`发现 ${duplicateMatches.length} 条疑似重复客户记录`}
            description={duplicateMatches
              .map((item) => `${item.code ?? '-'} ${item.customerName ?? ''}`)
              .join('；')}
            style={{ marginBottom: 20 }}
          />
        )}

        <Divider titlePlacement="start">机会归属</Divider>
        <ProFormText
          name="name"
          label="机会名称"
          rules={[{ required: true }]}
        />
        {canAssignOthers ? (
          <ProFormSelect
            name="ownerAdminId"
            label="负责人"
            options={ownerOptions}
            fieldProps={{ showSearch: true, optionFilterProp: 'label' }}
            rules={[{ required: true }]}
          />
        ) : (
          <ProFormText
            name="ownerDisplayName"
            label="负责人"
            disabled
            initialValue={
              editing?.ownerDisplayName ?? owners[0]?.displayName ?? '本人'
            }
          />
        )}

        <Divider titlePlacement="start">客户基础资料</Divider>
        <ProFormText
          name="customerName"
          label="客户企业名称"
          rules={[{ required: true }]}
        />
        <ProFormText
          name="website"
          label="客户官网"
          tooltip="可直接填写域名，系统会自动补全 https://"
          rules={[{ type: 'url', warningOnly: true }]}
        />
        <Space size="large" wrap>
          <ProFormText name="industry" label="所属行业" />
          <ProFormText name="region" label="所属地区" />
          <ProFormText
            name="brandName"
            label="品牌名称"
            rules={[{ required: true }]}
          />
        </Space>
        <Space size="large" wrap>
          <ProFormText name="contactName" label="主要联系人" />
          <ProFormText name="contactPhone" label="联系电话" />
          <ProFormText
            name="contactEmail"
            label="联系邮箱"
            rules={[{ type: 'email' }]}
          />
        </Space>
        <ProFormSelect
          name="brandAliasValues"
          label="品牌别名"
          mode="tags"
          placeholder="输入中文简称、英文名或常用缩写后按回车"
          tooltip="可连续输入多个别名，按回车确认；点击标签关闭按钮即可删除"
          fieldProps={{ tokenSeparators: [',', '，'] }}
        />

        <Divider titlePlacement="start">诊断背景</Divider>
        <ProFormTextArea
          name="targetAudience"
          label="目标客户"
          fieldProps={{ rows: 3 }}
        />
        <ProFormTextArea
          name="coreValue"
          label="品牌核心价值"
          fieldProps={{ rows: 3 }}
        />
        <ProFormTextArea
          name="currentContent"
          label="当前内容渠道和建设情况"
          fieldProps={{ rows: 3 }}
        />
        <ProFormTextArea
          name="painPoints"
          label="当前痛点"
          fieldProps={{ rows: 3 }}
        />
        <ProFormTextArea
          name="expectedGoals"
          label="预期目标"
          fieldProps={{ rows: 3 }}
        />

        <Divider titlePlacement="start">产品或服务</Divider>
        <ProFormList
          name="products"
          creatorButtonProps={{ creatorButtonText: '添加产品或服务' }}
          alwaysShowItemLabel
          itemRender={({ listDom, action }, { index }) => (
            <div
              style={{
                border: '1px solid rgba(5,5,5,.09)',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <Space align="start" style={{ width: '100%' }}>
                <Tag color="blue">{index + 1}</Tag>
                <div style={{ flex: 1 }}>{listDom}</div>
                {action}
              </Space>
            </div>
          )}
        >
          <ProForm.Group grid rowProps={{ gutter: [16, 0] }}>
            <ProFormText
              name="name"
              label="名称"
              colProps={{ xs: 24 }}
              rules={[{ required: true }]}
            />
            <ProFormTextArea
              name="description"
              label="说明"
              colProps={{ xs: 24 }}
              fieldProps={{ rows: 3 }}
            />
            <ProFormTextArea
              name="sellingPoints"
              label="主要卖点"
              colProps={{ xs: 24 }}
              fieldProps={{ rows: 3 }}
            />
            <ProFormTextArea
              name="targetAudience"
              label="目标客户"
              colProps={{ xs: 24 }}
              fieldProps={{ rows: 3 }}
            />
          </ProForm.Group>
        </ProFormList>

        <Divider titlePlacement="start">主要竞品</Divider>
        <ProFormList
          name="competitors"
          creatorButtonProps={{ creatorButtonText: '添加竞品' }}
          alwaysShowItemLabel
          itemRender={({ listDom, action }, { index }) => (
            <div
              style={{
                border: '1px solid rgba(5,5,5,.09)',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <Space align="start" style={{ width: '100%' }}>
                <Tag>{index + 1}</Tag>
                <div style={{ flex: 1 }}>{listDom}</div>
                {action}
              </Space>
            </div>
          )}
        >
          <ProForm.Group grid rowProps={{ gutter: [16, 0] }}>
            <ProFormText
              name="name"
              label="竞品名称"
              colProps={{ xs: 24, md: 8 }}
              rules={[{ required: true }]}
            />
            <ProFormText
              name="website"
              label="竞品官网"
              colProps={{ xs: 24, md: 16 }}
            />
            <ProFormTextArea
              name="description"
              label="竞品说明"
              colProps={{ xs: 24 }}
              fieldProps={{ rows: 3 }}
            />
          </ProForm.Group>
        </ProFormList>

        <Divider titlePlacement="start">预算与备注</Divider>
        <Space size="large" wrap>
          <ProFormDigit
            name="budgetMinYuan"
            label="预算下限（元）"
            min={0}
            precision={2}
          />
          <ProFormDigit
            name="budgetMaxYuan"
            label="预算上限（元）"
            min={0}
            precision={2}
          />
          <ProFormSelect
            name="currency"
            label="币种"
            options={[{ label: '人民币 CNY', value: 'CNY' }]}
          />
        </Space>
        <ProFormTextArea
          name="remark"
          label="销售备注"
          fieldProps={{ rows: 3 }}
        />
      </DrawerForm>

      <Drawer
        title={
          detail ? `${detail.name ?? '销售机会'} · 客户资料` : '销售机会详情'
        }
        width={880}
        open={Boolean(detail)}
        loading={detailLoading}
        onClose={() => setDetail(undefined)}
        extra={
          detail?.id ? (
            <Space>
              {access.canSalesOpportunityManage && (
                <Button
                  icon={<EditOutlined />}
                  onClick={() => openEdit(detail)}
                >
                  编辑
                </Button>
              )}
              <Button
                type="primary"
                icon={<FileSearchOutlined />}
                onClick={() =>
                  history.push(
                    `/sales/diagnoses/new?opportunityId=${detail.id}`,
                  )
                }
              >
                发起诊断
              </Button>
            </Space>
          ) : null
        }
      >
        {detail && <OpportunityDetail opportunity={detail} />}
      </Drawer>

      <ModalForm<StatusForm>
        title={statusAction?.title}
        open={Boolean(statusAction)}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setStatusAction(undefined),
        }}
        onFinish={async ({ reason }) => {
          const target = statusAction?.opportunity;
          if (!target?.id || !target.version || !statusAction) return false;
          await salesOpportunityServiceChangeSalesOpportunityStatus(
            { id: target.id },
            {
              id: target.id,
              version: target.version,
              status: statusAction.status,
              reason,
            },
          );
          message.success('销售机会状态已更新');
          setStatusAction(undefined);
          actionRef.current?.reload();
          return true;
        }}
      >
        <ProFormTextArea
          name="reason"
          label="操作原因"
          fieldProps={{ rows: 4 }}
          rules={[{ required: true, message: '请填写操作原因' }]}
        />
      </ModalForm>
    </PageContainer>
  );
}

function OpportunityDetail({
  opportunity,
}: {
  opportunity: API.SalesOpportunity;
}) {
  const budget =
    opportunity.budgetMinMinorUnits || opportunity.budgetMaxMinorUnits
      ? `${amountToYuan(opportunity.budgetMinMinorUnits) ?? 0} - ${amountToYuan(opportunity.budgetMaxMinorUnits) ?? '未设上限'} 元`
      : '未填写';
  return (
    <>
      <Descriptions bordered column={2} size="small" title="机会信息">
        <Descriptions.Item label="机会编号">
          {opportunity.code}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={salesOpportunityStatusColors[opportunity.status ?? 0]}>
            {salesOpportunityStatusLabel(opportunity.status)}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="负责人">
          {opportunity.ownerDisplayName || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="预算">{budget}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {opportunity.createdAt
            ? dayjs(opportunity.createdAt).format('YYYY-MM-DD HH:mm')
            : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {opportunity.updatedAt
            ? dayjs(opportunity.updatedAt).format('YYYY-MM-DD HH:mm')
            : '-'}
        </Descriptions.Item>
      </Descriptions>
      <Descriptions
        bordered
        column={2}
        size="small"
        title="客户资料"
        style={{ marginTop: 24 }}
      >
        <Descriptions.Item label="企业名称">
          {opportunity.customerName}
        </Descriptions.Item>
        <Descriptions.Item label="品牌名称">
          {opportunity.brandName}
        </Descriptions.Item>
        <Descriptions.Item label="官网">
          {opportunity.website || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="行业/地区">
          {[opportunity.industry, opportunity.region]
            .filter(Boolean)
            .join(' / ') || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="联系人">
          {opportunity.contactName || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="联系方式">
          {[opportunity.contactPhone, opportunity.contactEmail]
            .filter(Boolean)
            .join(' / ') || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="品牌别名" span={2}>
          <Space wrap>
            {opportunity.brandAliases?.length
              ? opportunity.brandAliases.map((item) => (
                  <Tag key={item.id ?? item.alias}>{item.alias}</Tag>
                ))
              : '-'}
          </Space>
        </Descriptions.Item>
      </Descriptions>
      <Descriptions
        bordered
        column={1}
        size="small"
        title="诊断背景"
        style={{ marginTop: 24 }}
      >
        <Descriptions.Item label="目标客户">
          {opportunity.targetAudience || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="核心价值">
          {opportunity.coreValue || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="内容现状">
          {opportunity.currentContent || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="当前痛点">
          {opportunity.painPoints || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="预期目标">
          {opportunity.expectedGoals || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="销售备注">
          {opportunity.remark || '-'}
        </Descriptions.Item>
      </Descriptions>
      <Divider titlePlacement="start">产品或服务</Divider>
      {opportunity.products?.length ? (
        <Table
          rowKey={(item) => item.id ?? `${item.sortOrder}-${item.name}`}
          pagination={false}
          size="small"
          dataSource={opportunity.products}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '说明', dataIndex: 'description' },
            { title: '主要卖点', dataIndex: 'sellingPoints' },
            { title: '目标客户', dataIndex: 'targetAudience' },
          ]}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂未填写产品或服务"
        />
      )}
      <Divider titlePlacement="start">主要竞品</Divider>
      {opportunity.competitors?.length ? (
        <Table
          rowKey={(item) => item.id ?? `${item.sortOrder}-${item.name}`}
          pagination={false}
          size="small"
          dataSource={opportunity.competitors}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '官网', dataIndex: 'website' },
            { title: '说明', dataIndex: 'description' },
          ]}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂未填写竞品"
        />
      )}
    </>
  );
}
