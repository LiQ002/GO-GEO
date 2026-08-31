import { ApiOutlined, PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProFormCheckbox,
  ProFormDependency,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  Divider,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useRef, useState } from 'react';
import { enterpriseServiceListEnterprises } from '@/services/geo-admin/enterpriseService';
import { planServiceListPlans } from '@/services/geo-admin/planService';
import {
  writingModelServiceCreateWritingModel,
  writingModelServiceDeleteWritingModel,
  writingModelServiceListWritingModels,
  writingModelServiceTestWritingModel,
  writingModelServiceUpdateWritingModel,
} from '@/services/geo-admin/writingModelService';
import { pageTokenFor } from '@/utils/admin-api';
import {
  optionLabel,
  optionValueEnum,
  PriceCurrency,
  priceCurrencyOptions,
  safetyCategoryOptions,
  WritingModelAccess,
  WritingModelCitationCapability,
  WritingModelDiagnosisAPI,
  WritingModelProtocol,
  WritingModelPurpose,
  WritingModelStatus,
  writingModelAccessOptions,
  writingModelCitationCapabilityOptions,
  writingModelDiagnosisAPIOptions,
  writingModelProtocolOptions,
  writingModelProviderOptions,
  writingModelPurposeOptions,
  writingModelStatusOptions,
} from '@/utils/platform-enums';

type WritingModelForm = Omit<
  API.WritingModel,
  'inputPriceMicrosPerMillionTokens' | 'outputPriceMicrosPerMillionTokens'
> & {
  apiKey?: string;
  replacementApiKey?: string;
  inputPricePerMillionTokens?: number;
  outputPricePerMillionTokens?: number;
};

const microsFromPrice = (value?: number) =>
  String(Math.round((value ?? 0) * 1_000_000));

const priceFromMicros = (value?: string | number) =>
  Number(value ?? 0) / 1_000_000;

const WritingModelsPage = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [editing, setEditing] = useState<API.WritingModel>();
  const [formOpen, setFormOpen] = useState(false);
  const [testing, setTesting] = useState<API.WritingModel>();
  const { message, modal } = App.useApp();

  const saveModel = async (values: WritingModelForm) => {
    if (
      values.diagnosisApiMode === WritingModelDiagnosisAPI.responses &&
      values.diagnosisWebSearchEnabled &&
      values.citationCapability !==
        WritingModelCitationCapability.providerSources
    ) {
      message.error('启用联网搜索时，诊断信源能力必须选择可核验信源');
      return false;
    }
    if (
      values.accessScope === WritingModelAccess.restricted &&
      !(values.visiblePlanIds?.length || values.visibleEnterpriseIds?.length)
    ) {
      message.error('限制可见时，请至少选择一个套餐或企业');
      return false;
    }
    const {
      apiKey,
      replacementApiKey,
      inputPricePerMillionTokens,
      outputPricePerMillionTokens,
      ...formModel
    } = values;
    const writingModel: API.WritingModel = {
      ...formModel,
      diagnosisWebSearchEnabled:
        values.diagnosisApiMode === WritingModelDiagnosisAPI.responses &&
        Boolean(values.diagnosisWebSearchEnabled),
      visiblePlanIds:
        values.accessScope === WritingModelAccess.restricted
          ? values.visiblePlanIds
          : [],
      visibleEnterpriseIds:
        values.accessScope === WritingModelAccess.restricted
          ? values.visibleEnterpriseIds
          : [],
      inputPriceMicrosPerMillionTokens: microsFromPrice(
        inputPricePerMillionTokens,
      ),
      outputPriceMicrosPerMillionTokens: microsFromPrice(
        outputPricePerMillionTokens,
      ),
    };
    if (editing?.id) {
      await writingModelServiceUpdateWritingModel(
        { 'writing_model.id': editing.id },
        {
          writingModel: { ...editing, ...writingModel },
          replacementApiKey,
        },
      );
      message.success('编写模型已更新');
    } else {
      await writingModelServiceCreateWritingModel({ writingModel, apiKey });
      message.success('编写模型已创建');
    }
    setFormOpen(false);
    setEditing(undefined);
    actionRef.current?.reload();
    return true;
  };

  const testModel = async (values: { prompt?: string }) => {
    if (!testing?.id) return false;
    const result = await writingModelServiceTestWritingModel(
      { id: testing.id },
      { id: testing.id, prompt: values.prompt },
    );
    if (result.success) {
      modal.success({
        title: '连接测试成功',
        content: (
          <Space orientation="vertical">
            <Typography.Text>耗时：{result.latencyMs ?? 0} ms</Typography.Text>
            <Typography.Paragraph copyable>
              {result.responsePreview || '模型已正常响应'}
            </Typography.Paragraph>
          </Space>
        ),
      });
    } else {
      modal.error({
        title: '连接测试失败',
        content: `${result.errorCode || 'UNKNOWN_ERROR'}（${result.latencyMs ?? 0} ms）`,
      });
    }
    setTesting(undefined);
    return true;
  };

  const columns: ProColumns<API.WritingModel>[] = [
    { title: '显示名称', dataIndex: 'displayName' },
    { title: '配置编码', dataIndex: 'code', copyable: true },
    {
      title: '提供商',
      dataIndex: 'provider',
      valueEnum: optionValueEnum(writingModelProviderOptions),
      render: (_, record) => (
        <Tag color="blue">
          {optionLabel(writingModelProviderOptions, record.provider)}
        </Tag>
      ),
    },
    { title: '模型 ID', dataIndex: 'modelId', copyable: true },
    {
      title: '适用场景',
      dataIndex: 'purposes',
      search: false,
      render: (_, record) => (
        <Space size={[4, 4]} wrap>
          {(record.purposes ?? []).map((purpose) => (
            <Tag key={purpose}>
              {optionLabel(writingModelPurposeOptions, purpose)}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: optionValueEnum(writingModelStatusOptions),
      render: (_, record) => (
        <Tag
          color={
            record.status === WritingModelStatus.active ? 'success' : 'default'
          }
        >
          {optionLabel(writingModelStatusOptions, record.status)}
        </Tag>
      ),
    },
    {
      title: '售前诊断',
      dataIndex: 'diagnosisApiMode',
      search: false,
      render: (_, record) =>
        (record.purposes ?? []).includes(WritingModelPurpose.salesDiagnosis) ? (
          <Space size={4} wrap>
            <Tag color="purple">
              {optionLabel(
                writingModelDiagnosisAPIOptions,
                record.diagnosisApiMode,
              )}
            </Tag>
            {record.diagnosisWebSearchEnabled ? (
              <Tag color="cyan">联网搜索</Tag>
            ) : null}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '密钥',
      dataIndex: 'credentialConfigured',
      search: false,
      render: (_, record) => (
        <Tag color={record.credentialConfigured ? 'success' : 'error'}>
          {record.credentialConfigured ? '已配置' : '未配置'}
        </Tag>
      ),
    },
    { title: '上下文长度', dataIndex: 'contextLength', search: false },
    {
      title: '可见范围',
      dataIndex: 'accessScope',
      search: false,
      render: (_, record) => (
        <Tag
          color={
            record.accessScope === WritingModelAccess.all ? 'green' : 'orange'
          }
        >
          {record.accessScope === WritingModelAccess.all
            ? '全部企业'
            : '指定范围'}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => [
        <Button
          key="test"
          type="link"
          icon={<ApiOutlined />}
          onClick={() => setTesting(record)}
        >
          连接测试
        </Button>,
        <Button
          key="edit"
          type="link"
          onClick={() => {
            setEditing(record);
            setFormOpen(true);
          }}
        >
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="确认删除该模型配置？"
          description="密钥密文将一并删除。"
          onConfirm={async () => {
            if (!record.id) return;
            await writingModelServiceDeleteWritingModel({
              id: record.id,
              version: record.version,
            });
            message.success('模型配置已删除');
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
    <PageContainer
      title="文章编写模型"
      subTitle="密钥仅在服务端加密保存，管理端只能替换，不能回显"
    >
      <ProTable<API.WritingModel>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const pageSize = params.pageSize ?? 20;
          const reply = await writingModelServiceListWritingModels({
            pageSize,
            pageToken: pageTokenFor(params.current, pageSize),
            keyword: params.displayName,
            provider: params.provider,
            status: params.status,
          });
          return {
            data: reply.items ?? [],
            total: Number(reply.totalSize ?? 0),
            success: true,
          };
        }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            新建模型
          </Button>,
        ]}
      />

      <ModalForm<WritingModelForm>
        key={editing?.id ?? 'create'}
        title={editing ? '编辑编写模型' : '新建编写模型'}
        open={formOpen}
        width={840}
        initialValues={
          editing
            ? {
                ...editing,
                inputPricePerMillionTokens: priceFromMicros(
                  editing.inputPriceMicrosPerMillionTokens,
                ),
                outputPricePerMillionTokens: priceFromMicros(
                  editing.outputPriceMicrosPerMillionTokens,
                ),
              }
            : {
                protocol: WritingModelProtocol.openAICompatible,
                status: WritingModelStatus.disabled,
                contextLength: 32768,
                sortOrder: 0,
                purposes: [
                  WritingModelPurpose.outline,
                  WritingModelPurpose.article,
                ],
                temperature: 0.7,
                topP: 1,
                maxTokens: 4096,
                timeoutSeconds: 120,
                citationCapability: WritingModelCitationCapability.none,
                diagnosisApiMode: WritingModelDiagnosisAPI.chatCompletions,
                diagnosisWebSearchEnabled: false,
                safetyEnabled: false,
                inputModerationEnabled: false,
                outputModerationEnabled: false,
                safetyFailClosed: true,
                blockedSafetyCategories: [],
                inputPricePerMillionTokens: 0,
                outputPricePerMillionTokens: 0,
                priceCurrency: PriceCurrency.cny,
                accessScope: WritingModelAccess.all,
                visiblePlanIds: [],
                visibleEnterpriseIds: [],
              }
        }
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(undefined);
        }}
        onFinish={saveModel}
      >
        <Space size="large">
          <ProFormText
            name="code"
            label="配置编码"
            disabled={Boolean(editing)}
            rules={[
              { required: true, message: '请输入配置编码' },
              {
                pattern: /^[a-z][a-z0-9_]*$/u,
                message: '仅支持小写字母、数字和下划线',
              },
            ]}
          />
          <ProFormText
            name="displayName"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          />
        </Space>
        <Space size="large">
          <ProFormSelect
            name="provider"
            label="提供商"
            options={writingModelProviderOptions}
            rules={[{ required: true, message: '请选择提供商' }]}
          />
          <ProFormSelect
            name="protocol"
            label="调用协议"
            options={writingModelProtocolOptions}
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={writingModelStatusOptions}
          />
        </Space>
        <ProFormText
          name="baseUrl"
          label="API Base URL"
          placeholder="https://api.example.com/v1"
          rules={[
            {
              required: true,
              type: 'url',
              message: '请输入有效的 HTTP(S) URL',
            },
          ]}
        />
        <Space size="large">
          <ProFormText
            name="modelId"
            label="模型 ID"
            rules={[{ required: true, message: '请输入模型 ID' }]}
          />
          <ProFormDigit
            name="contextLength"
            label="上下文长度"
            min={1}
            fieldProps={{ precision: 0 }}
          />
          <ProFormDigit
            name="sortOrder"
            label="排序"
            fieldProps={{ precision: 0 }}
          />
        </Space>
        {editing ? (
          <ProFormText.Password
            name="replacementApiKey"
            label="替换 API Key"
            extra="留空表示保留当前密钥"
          />
        ) : (
          <ProFormText.Password
            name="apiKey"
            label="API Key"
            rules={[{ required: true, message: '请输入 API Key' }]}
          />
        )}

        <Divider titlePlacement="left">生成能力</Divider>
        <ProFormCheckbox.Group
          name="purposes"
          label="适用场景"
          options={writingModelPurposeOptions}
          rules={[{ required: true, message: '请至少选择一个适用场景' }]}
        />
        <ProFormSelect
          name="citationCapability"
          label="诊断信源能力"
          options={writingModelCitationCapabilityOptions}
          tooltip="只有提供商接口真实返回 URL、标题等结构化元数据时才选择“可核验信源”；模型正文里自行写出的链接不会计入引用率。"
          rules={[{ required: true, message: '请选择诊断信源能力' }]}
        />
        <ProFormDependency name={['purposes']}>
          {({ purposes }) =>
            (purposes ?? []).includes(WritingModelPurpose.salesDiagnosis) ? (
              <>
                <ProFormSelect
                  name="diagnosisApiMode"
                  label="售前诊断 API"
                  options={writingModelDiagnosisAPIOptions}
                  tooltip="仅影响售前诊断；文章生成等其他场景仍使用 Chat Completions。"
                  rules={[{ required: true, message: '请选择售前诊断 API' }]}
                />
                <ProFormDependency
                  name={['diagnosisApiMode', 'citationCapability']}
                >
                  {({ diagnosisApiMode, citationCapability }) =>
                    diagnosisApiMode === WritingModelDiagnosisAPI.responses ? (
                      <>
                        <ProFormSwitch
                          name="diagnosisWebSearchEnabled"
                          label="启用原生联网搜索"
                          tooltip="诊断请求将使用 Responses API，并强制调用 web_search 工具。"
                        />
                        {citationCapability !==
                        WritingModelCitationCapability.providerSources ? (
                          <Alert
                            type="warning"
                            showIcon
                            title="启用联网搜索前，请将诊断信源能力设置为“接口返回可核验信源元数据”。"
                            style={{ marginBottom: 16 }}
                          />
                        ) : null}
                      </>
                    ) : null
                  }
                </ProFormDependency>
              </>
            ) : null
          }
        </ProFormDependency>
        <Space size="large" wrap>
          <ProFormDigit
            name="temperature"
            label="随机性 Temperature"
            min={0}
            max={2}
            fieldProps={{ precision: 2, step: 0.1 }}
            rules={[{ required: true, message: '请输入 Temperature' }]}
          />
          <ProFormDigit
            name="topP"
            label="采样范围 Top P"
            min={0}
            max={1}
            fieldProps={{ precision: 2, step: 0.1 }}
            rules={[{ required: true, message: '请输入 Top P' }]}
          />
          <ProFormDigit
            name="maxTokens"
            label="最大输出 Token"
            min={1}
            max={65536}
            fieldProps={{ precision: 0 }}
            rules={[{ required: true, message: '请输入最大输出 Token' }]}
          />
          <ProFormDigit
            name="timeoutSeconds"
            label="请求超时（秒）"
            min={1}
            max={600}
            fieldProps={{ precision: 0 }}
            rules={[{ required: true, message: '请输入请求超时' }]}
          />
        </Space>

        <Divider titlePlacement="left">内容安全</Divider>
        <ProFormSwitch name="safetyEnabled" label="启用内容安全策略" />
        <ProFormDependency name={['safetyEnabled']}>
          {({ safetyEnabled }) =>
            safetyEnabled ? (
              <>
                <Alert
                  type="info"
                  showIcon
                  title="此处记录平台安全策略；实际审核能力需由模型提供商或审核服务执行。"
                  style={{ marginBottom: 16 }}
                />
                <Space size="large" wrap>
                  <ProFormSwitch
                    name="inputModerationEnabled"
                    label="审核输入提示词"
                  />
                  <ProFormSwitch
                    name="outputModerationEnabled"
                    label="审核模型输出"
                  />
                  <ProFormSwitch
                    name="safetyFailClosed"
                    label="审核异常时阻止生成"
                  />
                </Space>
                <ProFormCheckbox.Group
                  name="blockedSafetyCategories"
                  label="阻止的内容类别"
                  options={safetyCategoryOptions}
                />
              </>
            ) : null
          }
        </ProFormDependency>

        <Divider titlePlacement="left">计价</Divider>
        <Space size="large" wrap>
          <ProFormDigit
            name="inputPricePerMillionTokens"
            label="输入单价（每百万 Token）"
            min={0}
            fieldProps={{ precision: 6 }}
            rules={[{ required: true, message: '请输入输入单价' }]}
          />
          <ProFormDigit
            name="outputPricePerMillionTokens"
            label="输出单价（每百万 Token）"
            min={0}
            fieldProps={{ precision: 6 }}
            rules={[{ required: true, message: '请输入输出单价' }]}
          />
          <ProFormSelect
            name="priceCurrency"
            label="计价币种"
            options={priceCurrencyOptions}
            rules={[{ required: true, message: '请选择计价币种' }]}
          />
        </Space>

        <Divider titlePlacement="left">企业可见范围</Divider>
        <ProFormSelect
          name="accessScope"
          label="可见方式"
          options={writingModelAccessOptions}
          rules={[{ required: true, message: '请选择可见方式' }]}
        />
        <ProFormDependency name={['accessScope']}>
          {({ accessScope }) =>
            accessScope === WritingModelAccess.restricted ? (
              <Space size="large" align="start" wrap>
                <ProFormSelect
                  name="visiblePlanIds"
                  label="可用套餐"
                  mode="multiple"
                  width="md"
                  request={async () => {
                    const reply = await planServiceListPlans({ pageSize: 100 });
                    return (reply.items ?? []).map((plan) => ({
                      label: plan.name,
                      value: plan.id,
                    }));
                  }}
                  placeholder="可选择多个套餐"
                />
                <ProFormSelect
                  name="visibleEnterpriseIds"
                  label="额外可用企业"
                  mode="multiple"
                  width="md"
                  request={async () => {
                    const reply = await enterpriseServiceListEnterprises({
                      pageSize: 100,
                    });
                    return (reply.items ?? [])
                      .filter((item) => item.enterprise?.id)
                      .map((item) => ({
                        label: item.enterprise?.name,
                        value: item.enterprise?.id,
                      }));
                  }}
                  placeholder="不受套餐限制的指定企业"
                />
              </Space>
            ) : null
          }
        </ProFormDependency>
      </ModalForm>

      <ModalForm<{ prompt?: string }>
        title={`测试模型：${testing?.displayName ?? ''}`}
        open={Boolean(testing)}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(open) => {
          if (!open) setTesting(undefined);
        }}
        onFinish={testModel}
      >
        <ProFormTextArea
          name="prompt"
          label="测试提示词"
          initialValue="请回复：连接测试成功"
          fieldProps={{ rows: 4 }}
        />
      </ModalForm>
    </PageContainer>
  );
};

export default WritingModelsPage;
