import { HistoryOutlined, PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProFormDigit,
  ProFormList,
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
  Collapse,
  Drawer,
  Popconfirm,
  Space,
  Tag,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  articleTypeServiceCreateArticleType,
  articleTypeServiceDeleteArticleType,
  articleTypeServiceListArticleTypes,
  articleTypeServiceListArticleTypeVersions,
  articleTypeServiceRollbackArticleType,
  articleTypeServiceUpdateArticleType,
} from '@/services/geo-admin/articleTypeService';
import { publishChannelServiceListPublishChannels } from '@/services/geo-admin/publishChannelService';
import { writingModelServiceListWritingModels } from '@/services/geo-admin/writingModelService';
import { pageTokenFor } from '@/utils/admin-api';
import {
  ArticleTypeSource,
  ArticleTypeStatus,
  articleTypeSourceOptions,
  articleTypeStatusOptions,
  optionLabel,
  optionValueEnum,
  PlatformConfigStatus,
  visibilityOptions,
  WritingModelStatus,
} from '@/utils/platform-enums';

type RuleFormItem = { text?: string };

type ArticleTypeConfigForm = Omit<
  API.ArticleTypeConfig,
  'geoRules' | 'qualityRules'
> & {
  geoRules?: RuleFormItem[];
  qualityRules?: RuleFormItem[];
};

type ArticleTypeForm = Pick<
  API.ArticleType,
  | 'code'
  | 'name'
  | 'description'
  | 'status'
  | 'visible'
  | 'sortOrder'
  | 'configChangeSummary'
> & { config?: ArticleTypeConfigForm };

const inputTypeOptions = [
  { label: '单行文本', value: 1 },
  { label: '多行文本', value: 2 },
  { label: '数字', value: 3 },
  { label: '单选', value: 4 },
  { label: '多选', value: 5 },
];

const defaultConfig: ArticleTypeConfigForm = {
  contentGoal: '围绕企业真实知识生成结构清晰、可被 AI 搜索理解和引用的专业文章',
  targetAudience: '正在搜索相关问题解决方案的潜在客户',
  tone: '专业、客观、可信',
  recommendedMinWords: 800,
  recommendedMaxWords: 1600,
  sections: [
    {
      title: '问题与背景',
      guidance: '说明读者面临的问题和文章的核心结论。',
      required: true,
    },
    {
      title: '核心内容',
      guidance: '按照逻辑层次展开，优先使用企业知识库中可验证的事实。',
      required: true,
    },
    {
      title: '总结与建议',
      guidance: '总结要点并给出可执行的下一步建议。',
      required: true,
    },
  ],
  inputFields: [
    {
      key: 'topic',
      label: '文章主题',
      inputType: 1,
      required: true,
      placeholder: '请输入本次写作主题',
    },
  ],
  geoRules: [
    { text: '标题和小标题准确表达用户问题与核心答案。' },
    { text: '重要概念给出清晰定义，结论尽量附带事实或知识库依据。' },
  ],
  qualityRules: [
    { text: '不编造企业数据、客户案例或无法验证的结论。' },
    { text: '段落简洁，避免空洞的广告话术和重复表达。' },
  ],
  systemPrompt:
    '你是企业 GEO 内容策略与写作专家。你必须基于提供的企业知识和用户输入写作，不得编造事实，并以 Markdown 输出完整文章。',
  userPromptTemplate:
    '请以“{{.topic}}”为主题，结合企业知识库与上述结构、GEO 规则和质量规则生成文章。',
  outputFormat: 1,
  writingModelIds: [],
  publishChannelIds: [],
};

const ArticleTypesPage = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [editing, setEditing] = useState<API.ArticleType>();
  const [formOpen, setFormOpen] = useState(false);
  const [versionOwner, setVersionOwner] = useState<API.ArticleType>();
  const [versions, setVersions] = useState<API.ArticleTypeVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [modelOptions, setModelOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [channelOptions, setChannelOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const { message } = App.useApp();

  useEffect(() => {
    let active = true;
    void Promise.all([
      writingModelServiceListWritingModels({
        pageSize: 100,
        status: WritingModelStatus.active,
      }),
      publishChannelServiceListPublishChannels({
        pageSize: 100,
        status: PlatformConfigStatus.active,
      }),
    ]).then(([modelReply, channelReply]) => {
      if (!active) return;
      setModelOptions(
        (modelReply.items ?? []).flatMap((item) =>
          item.id
            ? [
                {
                  label: `${item.displayName ?? item.modelId ?? '未命名模型'} · ${item.modelId ?? item.id}`,
                  value: item.id,
                },
              ]
            : [],
        ),
      );
      setChannelOptions(
        (channelReply.items ?? []).flatMap((item) =>
          item.id
            ? [
                {
                  label: item.name ?? item.code ?? `渠道 #${item.id}`,
                  value: item.id,
                },
              ]
            : [],
        ),
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const loadVersions = useCallback(async (owner: API.ArticleType) => {
    if (!owner.id) return;
    setVersionsLoading(true);
    try {
      const reply = await articleTypeServiceListArticleTypeVersions({
        articleTypeId: owner.id,
      });
      setVersions(reply.items ?? []);
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  const openVersions = async (record: API.ArticleType) => {
    setVersionOwner(record);
    await loadVersions(record);
  };

  const saveArticleType = async (values: ArticleTypeForm) => {
    const config = normalizeConfig(values.config);
    if (
      config.defaultWritingModelId &&
      !config.writingModelIds?.includes(config.defaultWritingModelId)
    ) {
      message.error('默认模型必须包含在可用写作模型中');
      return false;
    }
    const payload: API.ArticleType = {
      ...(editing ?? {}),
      ...values,
      config,
      icon: editing?.icon,
      visibilityJson: editing?.visibilityJson,
    };
    if (editing?.id) {
      await articleTypeServiceUpdateArticleType(
        { 'article_type.id': editing.id },
        { articleType: payload },
      );
      message.success('文章类型已更新，并自动保存为新的配置修订');
    } else {
      await articleTypeServiceCreateArticleType({ articleType: payload });
      message.success('文章类型已创建');
    }
    setFormOpen(false);
    setEditing(undefined);
    actionRef.current?.reload();
    return true;
  };

  const rollback = async (version: API.ArticleTypeVersion) => {
    if (!versionOwner?.id || !versionOwner.version || !version.id) return;
    const updated = await articleTypeServiceRollbackArticleType(
      { articleTypeId: versionOwner.id },
      {
        articleTypeId: versionOwner.id,
        versionId: version.id,
        expectedVersion: versionOwner.version,
      },
    );
    message.success(`已回滚到配置修订 v${version.versionNumber ?? '-'}`);
    setVersionOwner(updated);
    await loadVersions(updated);
    actionRef.current?.reload();
  };

  const columns: ProColumns<API.ArticleType>[] = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => {
            setEditing(record);
            setFormOpen(true);
          }}
        >
          {record.name}
        </Button>
      ),
    },
    { title: '编码', dataIndex: 'code', copyable: true },
    {
      title: '来源',
      dataIndex: 'sourceType',
      valueEnum: optionValueEnum(articleTypeSourceOptions),
      render: (_, record) => (
        <Tag
          color={
            record.sourceType === ArticleTypeSource.system ? 'blue' : 'purple'
          }
        >
          {optionLabel(articleTypeSourceOptions, record.sourceType)}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: optionValueEnum(articleTypeStatusOptions),
      render: (_, record) => (
        <Tag
          color={
            record.status === ArticleTypeStatus.active ? 'success' : 'default'
          }
        >
          {optionLabel(articleTypeStatusOptions, record.status)}
        </Tag>
      ),
    },
    {
      title: '企业可见',
      dataIndex: 'visible',
      valueType: 'select',
      valueEnum: optionValueEnum(visibilityOptions),
      render: (_, record) =>
        record.visible ? <Tag color="success">可见</Tag> : <Tag>隐藏</Tag>,
    },
    {
      title: '当前配置',
      dataIndex: 'configRevision',
      search: false,
      render: (_, record) => (
        <Tag color="processing">v{record.configRevision ?? 0}</Tag>
      ),
    },
    {
      title: '生成规格',
      search: false,
      render: (_, record) => (
        <span>
          {record.config?.recommendedMinWords ?? 0}–
          {record.config?.recommendedMaxWords ?? 0} 字 ·{' '}
          {record.config?.sections?.length ?? 0} 个章节 ·{' '}
          {record.config?.writingModelIds?.length
            ? `${record.config.writingModelIds.length} 个模型`
            : '不限模型'}
        </span>
      ),
    },
    { title: '排序', dataIndex: 'sortOrder', search: false, width: 70 },
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
          key="edit"
          type="link"
          onClick={() => {
            setEditing(record);
            setFormOpen(true);
          }}
        >
          编辑配置
        </Button>,
        <Button
          key="history"
          type="link"
          icon={<HistoryOutlined />}
          onClick={() => openVersions(record)}
        >
          修订记录
        </Button>,
        <Popconfirm
          key="delete"
          title="确认删除该文章类型？"
          description="已被生成任务引用时后端将拒绝删除。"
          onConfirm={async () => {
            if (!record.id) return;
            await articleTypeServiceDeleteArticleType({
              id: record.id,
              version: record.version,
            });
            message.success('文章类型已删除');
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

  const versionColumns: ProColumns<API.ArticleTypeVersion>[] = [
    {
      title: '修订',
      dataIndex: 'versionNumber',
      renderText: (value) => `v${value}`,
    },
    {
      title: '状态',
      render: (_, record) =>
        record.id === versionOwner?.currentVersionId ? (
          <Tag color="blue">当前生效</Tag>
        ) : (
          <Tag>历史修订</Tag>
        ),
    },
    {
      title: '配置摘要',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <span>{record.config?.contentGoal || record.contentGoal || '-'}</span>
          <span style={{ color: 'rgba(0,0,0,.45)', fontSize: 12 }}>
            {record.config?.recommendedMinWords ??
              record.recommendedMinWords ??
              0}
            –
            {record.config?.recommendedMaxWords ??
              record.recommendedMaxWords ??
              0}{' '}
            字 · {record.config?.sections?.length ?? 0} 个章节
          </span>
        </Space>
      ),
    },
    { title: '变更说明', dataIndex: 'changeSummary', ellipsis: true },
    { title: '操作人 ID', dataIndex: 'publishedBy', width: 110 },
    { title: '保存时间', dataIndex: 'createdAt', valueType: 'dateTime' },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) =>
        record.id === versionOwner?.currentVersionId
          ? []
          : [
              <Popconfirm
                key="rollback"
                title={`回滚到配置修订 v${record.versionNumber ?? '-'}？`}
                description="回滚只切换当前生效配置，不会删除后续修订。"
                onConfirm={() => rollback(record)}
              >
                <Button type="link">回滚</Button>
              </Popconfirm>,
            ],
    },
  ];

  const initialValues = useMemo<ArticleTypeForm>(() => {
    if (!editing) {
      return {
        status: ArticleTypeStatus.draft,
        visible: true,
        sortOrder: 0,
        config: configToForm(),
      };
    }
    return {
      ...editing,
      config: configToForm(editing.config),
      configChangeSummary: '',
    };
  }, [editing]);

  return (
    <PageContainer
      title="文章类型库"
      subTitle="以创作提示词和写作提示词为核心；结构、输入项、模型与渠道按需高级配置"
    >
      <ProTable<API.ArticleType>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const pageSize = params.pageSize ?? 20;
          const reply = await articleTypeServiceListArticleTypes({
            pageSize,
            pageToken: pageTokenFor(params.current, pageSize),
            keyword: params.name,
            status: params.status,
            sourceType: params.sourceType,
            visible:
              params.visible === undefined ? undefined : params.visible === 1,
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
            新建文章类型
          </Button>,
        ]}
      />

      <ModalForm<ArticleTypeForm>
        key={editing?.id ?? 'create'}
        title={
          editing ? `编辑文章类型 · ${editing.name ?? ''}` : '新建文章类型'
        }
        open={formOpen}
        width="min(980px, 94vw)"
        initialValues={initialValues}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(undefined);
        }}
        onFinish={saveArticleType}
      >
        <Alert
          showIcon
          type="info"
          title="企业创作页会自动使用这里的配置"
          description="企业用户只选择文章类型；系统自动带入提示词，并按高级配置显示额外输入项、可用模型和投放渠道。每次保存会生成不可变配置修订。"
          style={{ marginBottom: 20 }}
        />

        <ProFormText
          name="code"
          label="类型编码"
          disabled={Boolean(editing)}
          rules={[
            { required: true, message: '请输入类型编码' },
            {
              pattern: /^[a-z][a-z0-9_]*$/u,
              message: '仅支持小写字母、数字和下划线',
            },
          ]}
        />
        <ProFormText
          name="name"
          label="类型名称"
          disabled={editing?.sourceType === ArticleTypeSource.system}
          rules={[{ required: true, message: '请输入类型名称' }]}
        />
        <ProFormTextArea
          name="description"
          label="类型说明"
          fieldProps={{ rows: 2 }}
        />

        <FormSection
          title="核心提示词"
          description="这是文章类型最重要的配置：创作提示词定义角色、原则与输出边界；写作提示词组织本次品牌、关键词、问题和用户要求。"
        >
          <ProFormTextArea
            name={['config', 'systemPrompt']}
            label="创作提示词"
            tooltip="用于定义创作角色、事实边界、内容风格和 Markdown 输出要求"
            rules={[{ required: true, message: '请输入创作提示词' }]}
            fieldProps={{ rows: 6, showCount: true, maxLength: 8000 }}
          />
          <ProFormTextArea
            name={['config', 'userPromptTemplate']}
            label="写作提示词"
            tooltip="用于组织单次写作任务，可使用 {{.brand_name}}、{{.target_question}}、{{.user_instruction}} 以及高级配置中的输入项变量"
            rules={[{ required: true, message: '请输入写作提示词' }]}
            fieldProps={{ rows: 8, showCount: true, maxLength: 12000 }}
          />
        </FormSection>

        <Collapse
          style={{ marginTop: 24 }}
          items={[
            {
              key: 'advanced',
              label: (
                <div>
                  <strong>高级配置</strong>
                  <div
                    style={{
                      color: 'rgba(0,0,0,.45)',
                      fontSize: 12,
                      fontWeight: 400,
                      marginTop: 4,
                    }}
                  >
                    发布状态、内容规格、企业输入项、GEO 规则、模型与渠道
                  </div>
                </div>
              ),
              forceRender: true,
              children: (
                <div>
                  <FormSection
                    title="发布设置"
                    description="控制企业端是否可选择该文章类型及列表排序。"
                  >
                    <Space size="large" wrap>
                      <ProFormSelect
                        name="status"
                        label="状态"
                        options={articleTypeStatusOptions}
                        rules={[{ required: true }]}
                      />
                      <ProFormSwitch name="visible" label="企业可见" />
                      <ProFormDigit
                        name="sortOrder"
                        label="排序"
                        fieldProps={{ precision: 0 }}
                      />
                    </Space>
                  </FormSection>

                  <FormSection
                    title="生成目标"
                    description="定义这类文章要帮读者解决什么问题。"
                  >
                    <ProFormTextArea
                      name={['config', 'contentGoal']}
                      label="内容目标"
                      rules={[{ required: true, message: '请输入内容目标' }]}
                      fieldProps={{ rows: 3 }}
                    />
                    <Space size="large" wrap>
                      <ProFormText
                        name={['config', 'targetAudience']}
                        label="目标受众"
                      />
                      <ProFormText name={['config', 'tone']} label="文章语气" />
                      <ProFormDigit
                        name={['config', 'recommendedMinWords']}
                        label="建议最少字数"
                        min={0}
                        fieldProps={{ precision: 0 }}
                      />
                      <ProFormDigit
                        name={['config', 'recommendedMaxWords']}
                        label="建议最多字数"
                        min={0}
                        fieldProps={{ precision: 0 }}
                      />
                    </Space>
                  </FormSection>

                  <FormSection
                    title="文章结构"
                    description="按顺序维护应生成的章节，不需要编写 JSON。"
                  >
                    <ProFormList
                      name={['config', 'sections']}
                      creatorButtonProps={{ creatorButtonText: '添加章节' }}
                      min={1}
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
                      <ProFormText
                        name="title"
                        label="章节标题"
                        rules={[{ required: true }]}
                      />
                      <ProFormTextArea
                        name="guidance"
                        label="写作要求"
                        fieldProps={{ rows: 2 }}
                      />
                      <ProFormSwitch name="required" label="必须生成" />
                    </ProFormList>
                  </FormSection>

                  <FormSection
                    title="用户输入项"
                    description="企业用户选择该文章类型后，页面会根据这些配置动态生成表单。"
                  >
                    <ProFormList
                      name={['config', 'inputFields']}
                      creatorButtonProps={{ creatorButtonText: '添加输入项' }}
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
                      <Space size="large" wrap>
                        <ProFormText
                          name="key"
                          label="变量键名"
                          tooltip="用于提示词中的 {{.key}} 变量"
                          rules={[
                            { required: true },
                            {
                              pattern: /^[a-z][a-z0-9_]{0,63}$/u,
                              message: '请使用小写英文、数字和下划线',
                            },
                          ]}
                        />
                        <ProFormText
                          name="label"
                          label="中文名称"
                          rules={[{ required: true }]}
                        />
                        <ProFormSelect
                          name="inputType"
                          label="输入类型"
                          options={inputTypeOptions}
                          rules={[{ required: true }]}
                        />
                        <ProFormSwitch name="required" label="必填" />
                      </Space>
                      <ProFormText name="placeholder" label="输入提示" />
                      <ProFormText name="helpText" label="帮助说明" />
                      <ProFormSelect
                        name="options"
                        label="可选项"
                        tooltip="仅单选和多选使用，输入后回车添加"
                        mode="tags"
                      />
                      <ProFormText name="defaultValue" label="默认值" />
                    </ProFormList>
                  </FormSection>

                  <FormSection
                    title="GEO 与质量规则"
                    description="每条规则单独管理，后端会按顺序组装到生成上下文。"
                  >
                    <ProFormList
                      name={['config', 'geoRules']}
                      label="GEO 优化规则"
                      creatorButtonProps={{
                        creatorButtonText: '添加 GEO 规则',
                      }}
                    >
                      <ProFormText name="text" rules={[{ required: true }]} />
                    </ProFormList>
                    <ProFormList
                      name={['config', 'qualityRules']}
                      label="质量检查规则"
                      creatorButtonProps={{ creatorButtonText: '添加质量规则' }}
                    >
                      <ProFormText name="text" rules={[{ required: true }]} />
                    </ProFormList>
                  </FormSection>

                  <FormSection
                    title="模型与渠道"
                    description="限定这类文章可用的写作模型和适用投放渠道；不选表示不限制。"
                  >
                    <ProFormSelect
                      name={['config', 'writingModelIds']}
                      label="可用写作模型"
                      mode="multiple"
                      options={modelOptions}
                      fieldProps={{ optionFilterProp: 'label' }}
                    />
                    <ProFormSelect
                      name={['config', 'defaultWritingModelId']}
                      label="默认写作模型"
                      options={modelOptions}
                      fieldProps={{
                        allowClear: true,
                        optionFilterProp: 'label',
                      }}
                    />
                    <ProFormSelect
                      name={['config', 'publishChannelIds']}
                      label="适用投放渠道"
                      mode="multiple"
                      options={channelOptions}
                      fieldProps={{ optionFilterProp: 'label' }}
                    />
                  </FormSection>
                </div>
              ),
            },
          ]}
        />

        <ProFormTextArea
          name="configChangeSummary"
          label="本次配置变更说明"
          tooltip="保存后写入修订记录，便于审计和回滚"
          fieldProps={{ rows: 2, maxLength: 1024, showCount: true }}
          rules={
            editing ? [{ required: true, message: '请说明本次配置变更' }] : []
          }
        />
      </ModalForm>

      <Drawer
        title={`${versionOwner?.name ?? ''} · 配置修订记录`}
        open={Boolean(versionOwner)}
        size="large"
        onClose={() => {
          setVersionOwner(undefined);
          setVersions([]);
        }}
      >
        <Alert
          showIcon
          type="info"
          title="修订由保存文章类型时自动生成"
          description="历史修订不可直接编辑。如需恢复，可回滚到任意一个修订；已生成文章始终保留当时锁定的修订。"
          style={{ marginBottom: 16 }}
        />
        <ProTable<API.ArticleTypeVersion>
          rowKey="id"
          columns={versionColumns}
          dataSource={versions}
          loading={versionsLoading}
          search={false}
          pagination={false}
          options={false}
        />
      </Drawer>
    </PageContainer>
  );
};

function FormSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section
      style={{
        borderTop: '1px solid rgba(5,5,5,.08)',
        marginTop: 24,
        paddingTop: 20,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
      <p style={{ color: 'rgba(0,0,0,.45)', margin: '6px 0 18px' }}>
        {description}
      </p>
      {children}
    </section>
  );
}

function configToForm(config?: API.ArticleTypeConfig): ArticleTypeConfigForm {
  const source = config ?? normalizeConfig(defaultConfig);
  return {
    ...source,
    sections: source.sections?.map((item) => ({ ...item })) ?? [],
    inputFields:
      source.inputFields?.map((item) => ({
        ...item,
        options: [...(item.options ?? [])],
      })) ?? [],
    geoRules: (source.geoRules ?? []).map((text) => ({ text })),
    qualityRules: (source.qualityRules ?? []).map((text) => ({ text })),
  };
}

function normalizeConfig(
  config?: ArticleTypeConfigForm,
): API.ArticleTypeConfig {
  return {
    ...config,
    outputFormat: 1,
    contentGoal: config?.contentGoal?.trim(),
    targetAudience: config?.targetAudience?.trim(),
    tone: config?.tone?.trim(),
    sections: (config?.sections ?? []).map((item) => ({
      ...item,
      title: item.title?.trim(),
      guidance: item.guidance?.trim(),
    })),
    inputFields: (config?.inputFields ?? []).map((item) => ({
      ...item,
      key: item.key?.trim(),
      label: item.label?.trim(),
      placeholder: item.placeholder?.trim(),
      helpText: item.helpText?.trim(),
      options: (item.options ?? [])
        .map((option) => option.trim())
        .filter(Boolean),
    })),
    geoRules: (config?.geoRules ?? [])
      .map((item) => item.text?.trim() ?? '')
      .filter(Boolean),
    qualityRules: (config?.qualityRules ?? [])
      .map((item) => item.text?.trim() ?? '')
      .filter(Boolean),
    systemPrompt: config?.systemPrompt?.trim(),
    userPromptTemplate: config?.userPromptTemplate?.trim(),
    writingModelIds: config?.writingModelIds ?? [],
    publishChannelIds: config?.publishChannelIds ?? [],
  };
}

export default ArticleTypesPage;
