import { FileSearchOutlined, PlusOutlined } from '@ant-design/icons';
import {
  PageContainer,
  ProForm,
  ProFormList,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { history, useSearchParams } from '@umijs/max';
import { Alert, App, Button, Card, Collapse, Descriptions, Spin } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { enterpriseServiceGetEnterprise } from '@/services/geo-admin/enterpriseService';
import { salesDiagnosisServiceCreateSalesDiagnosis } from '@/services/geo-admin/salesDiagnosisService';
import { salesOpportunityServiceGetSalesOpportunity } from '@/services/geo-admin/salesOpportunityService';
import { writingModelServiceListWritingModels } from '@/services/geo-admin/writingModelService';
import {
  WritingModelCitationCapability,
  WritingModelPurpose,
  WritingModelStatus,
  writingModelProviderOptions,
} from '@/utils/platform-enums';
import { SalesDiagnosisSubjectType } from '@/utils/sales-diagnosis-enums';

type DiagnosisForm = {
  customerName?: string;
  brandName?: string;
  name?: string;
  questions?: { question?: string }[];
  writingModelIds?: string[];
  startImmediately?: boolean;
};

const providerLabel = (provider?: number) =>
  writingModelProviderOptions.find((item) => item.value === provider)?.label ??
  '兼容模型';

export default function NewSalesDiagnosisPage() {
  const [params] = useSearchParams();
  const opportunityId = params.get('opportunityId') ?? undefined;
  const enterpriseId = params.get('enterpriseId') ?? undefined;
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [opportunity, setOpportunity] = useState<API.SalesOpportunity>();
  const [enterprise, setEnterprise] = useState<API.Enterprise>();
  const [models, setModels] = useState<API.WritingModel[]>([]);

  useEffect(() => {
    void Promise.all([
      opportunityId
        ? salesOpportunityServiceGetSalesOpportunity({ id: opportunityId })
        : Promise.resolve(undefined),
      enterpriseId
        ? enterpriseServiceGetEnterprise({ id: enterpriseId }).then(
            (reply) => reply.enterprise,
          )
        : Promise.resolve(undefined),
      writingModelServiceListWritingModels({
        pageSize: 200,
        status: WritingModelStatus.active,
      }),
    ])
      .then(([opportunityReply, enterpriseReply, modelReply]) => {
        setOpportunity(opportunityReply);
        setEnterprise(enterpriseReply);
        setModels(
          (modelReply.items ?? []).filter((model) =>
            model.purposes?.includes(WritingModelPurpose.salesDiagnosis),
          ),
        );
      })
      .finally(() => setLoading(false));
  }, [enterpriseId, opportunityId]);

  const sourceName = opportunity?.customerName ?? enterprise?.name ?? '';
  const brandName = opportunity?.brandName ?? enterprise?.name ?? '';
  const linkedSubject = Boolean(opportunityId || enterpriseId);
  const modelOptions = useMemo(
    () =>
      models.flatMap((model) =>
        model.id
          ? [
              {
                label: `${model.displayName ?? model.modelId ?? model.code} · ${providerLabel(model.provider)}${model.citationCapability === WritingModelCitationCapability.providerSources ? ' · 可核验信源' : ' · 模型知识'}`,
                value: model.id,
              },
            ]
          : [],
      ),
    [models],
  );

  if (loading) {
    return (
      <PageContainer title="发起 GEO 售前诊断">
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <Spin tip="正在读取客户资料和模型配置" />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="发起 GEO 售前诊断"
      onBack={() => history.back()}
      extra={
        <Button onClick={() => history.push('/sales/diagnoses')}>
          查看诊断记录
        </Button>
      }
    >
      {linkedSubject && (
        <Card title="诊断对象" style={{ marginBottom: 16 }}>
          <Descriptions column={{ xs: 1, sm: 2, lg: 3 }}>
            <Descriptions.Item label="客户">{sourceName}</Descriptions.Item>
            <Descriptions.Item label="品牌">
              {brandName || '未填写'}
            </Descriptions.Item>
            <Descriptions.Item label="行业">
              {opportunity?.industry ?? enterprise?.industry ?? '未填写'}
            </Descriptions.Item>
            <Descriptions.Item label="官网">
              {opportunity?.website ?? '未填写'}
            </Descriptions.Item>
            <Descriptions.Item label="客户痛点" span={2}>
              {opportunity?.painPoints ?? '未填写'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {models.length === 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="暂无可用于售前诊断的模型"
          description="请先在“模型配置”中启用模型，并勾选“售前诊断”用途。"
        />
      )}

      {models.length > 0 &&
        !models.some(
          (model) =>
            model.citationCapability ===
            WritingModelCitationCapability.providerSources,
        ) && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="当前没有可核验联网信源模型"
            description="仍可自动生成完整诊断流程，但现有模型回答会按“模型知识”记录，不能作为实时联网检索证据。若需要类似报告 skill 的公开资料核验，请增加支持原生搜索并返回来源的模型配置。"
          />
        )}

      <Card title="快速生成 GEO 售前诊断">
        <ProForm<DiagnosisForm>
          initialValues={{
            customerName: sourceName,
            brandName,
            name: brandName ? `${brandName} GEO 售前诊断` : undefined,
            questions: [],
            startImmediately: true,
          }}
          submitter={{
            searchConfig: { submitText: '创建诊断', resetText: '重置' },
            submitButtonProps: { disabled: models.length === 0 },
          }}
          onFinish={async (values) => {
            const questions = (values.questions ?? []).flatMap((item) =>
              item.question?.trim() ? [item.question.trim()] : [],
            );
            const effectiveModelCount =
              values.writingModelIds?.length || models.length;
            if (effectiveModelCount < 2) {
              message.warning(
                '仅选择一个模型只能代表单一模型样本，建议至少选择两个模型再创建',
              );
            }
            const diagnosis = await salesDiagnosisServiceCreateSalesDiagnosis({
              name: values.name?.trim(),
              subjectType: opportunityId
                ? SalesDiagnosisSubjectType.opportunity
                : enterpriseId
                  ? SalesDiagnosisSubjectType.enterprise
                  : SalesDiagnosisSubjectType.quickBrand,
              opportunityId,
              enterpriseId,
              customerName: values.customerName?.trim(),
              brandName: values.brandName?.trim(),
              questions,
              writingModelIds: values.writingModelIds,
              startImmediately: values.startImmediately,
            });
            message.success('诊断已创建');
            history.push(`/sales/diagnoses/${diagnosis.id}`);
            return true;
          }}
        >
          {!linkedSubject && (
            <ProForm.Group grid rowProps={{ gutter: 16 }}>
              <ProFormText
                name="customerName"
                label="客户名称"
                colProps={{ xs: 24, md: 12 }}
                rules={[{ required: true, message: '请输入客户名称' }]}
              />
              <ProFormText
                name="brandName"
                label="品牌名称"
                colProps={{ xs: 24, md: 12 }}
                rules={[{ required: true, message: '请输入品牌名称' }]}
              />
            </ProForm.Group>
          )}
          <Alert
            showIcon
            type="success"
            style={{ marginBottom: 20 }}
            message="无需手工准备诊断问题"
            description="不填写高级设置时，后台先选择一个模型完成品牌主体辨识、品牌词和统一问题生成；准备成功后，再把同一组问题分别发送给最多 10 个已配置模型平台。两个阶段均异步执行并保留调用记录。"
          />
          <Collapse
            ghost
            items={[
              {
                key: 'advanced',
                label: '高级设置（可选）',
                children: (
                  <>
                    <ProFormText
                      name="name"
                      label="诊断名称"
                      placeholder="留空时使用“品牌名称 GEO 售前诊断”"
                    />
                    <ProFormSelect
                      name="writingModelIds"
                      label="指定参与模型"
                      mode="multiple"
                      options={modelOptions}
                      fieldProps={{ optionFilterProp: 'label' }}
                      tooltip="留空时按配置顺序自动使用最多 10 个已启用售前诊断用途的模型"
                      extra="只有模型接口原生支持联网搜索并返回结构化来源时，报告才会把回答计为可核验联网证据。"
                    />
                    <ProFormList
                      name="questions"
                      label="自定义诊断问题（填写后替换自动问题）"
                      creatorButtonProps={{
                        creatorButtonText: '添加自定义问题',
                        icon: <PlusOutlined />,
                      }}
                      copyIconProps={{ tooltipText: '复制问题' }}
                      deleteIconProps={{ tooltipText: '删除问题' }}
                      max={50}
                    >
                      <ProFormTextArea
                        name="question"
                        label="问题"
                        fieldProps={{
                          rows: 3,
                          showCount: true,
                          maxLength: 1000,
                        }}
                        rules={[{ required: true, message: '请输入问题' }]}
                      />
                    </ProFormList>
                    <ProFormSwitch
                      name="startImmediately"
                      label="创建后立即执行"
                      tooltip="关闭后可以在详情页确认问题和模型，再手动发起异步执行"
                    />
                  </>
                ),
              },
            ]}
          />
          <Alert
            icon={<FileSearchOutlined />}
            showIcon
            type="info"
            message="诊断结果说明"
            description="系统会要求具备搜索能力的模型优先联网核验；普通兼容模型接口的回答仍按“模型知识回答”保存。只有模型提供商实际返回可核验来源时，才会计入引用率，避免把模型陈述误当成实时检索结果。"
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
}
