import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProFormSelect,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Descriptions,
  Drawer,
  Space,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import XMarkdown from '@ant-design/x-markdown';
import '@ant-design/x-markdown/es/XMarkdown/index.css';
import { useRef, useState, type ReactNode } from 'react';
import {
  articleServiceGetArticle,
  articleServiceListArticles,
  articleServiceReviewArticle,
} from '@/services/geo-admin/articleService';
import { pageTokenFor } from '@/utils/admin-api';
import {
  apiOptionLabel,
  apiOptionValue,
  articleReviewActionOptions,
  articleSourceOptions,
  articleWorkflowStatusOptions,
  optionValueEnum,
} from '@/utils/platform-enums';

type ActionForm = { action: number; reason: string };

const reviewActionByStatus: Record<string, number> = {
  draft: 1,
  pending_review: 1,
  normal: 2,
  disabled: 1,
};

export default function ArticlesPage() {
  const actionRef = useRef<ActionType | null>(null);
  const [detail, setDetail] = useState<API.ArticleDetail>();
  const [selected, setSelected] = useState<API.Article>();
  const [actionOpen, setActionOpen] = useState(false);
  const [initialAction, setInitialAction] = useState<number>(1);
  const { message } = App.useApp();
  const openDetail = async (id?: string) => {
    if (id) setDetail(await articleServiceGetArticle({ id }));
  };
  const openReview = (row: API.Article | undefined, presetAction?: number) => {
    if (!row) return;
    setSelected(row);
    setInitialAction(
      presetAction ?? reviewActionByStatus[row.status ?? ''] ?? 1,
    );
    setActionOpen(true);
  };
  const columns: ProColumns<API.Article>[] = [
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '企业', dataIndex: 'enterpriseName', search: false },
    {
      title: '企业 ID',
      dataIndex: 'enterpriseId',
      valueType: 'digit',
      hideInTable: true,
    },
    { title: '品牌', dataIndex: 'brandName', search: false },
    {
      title: '来源',
      dataIndex: 'source',
      valueEnum: optionValueEnum(articleSourceOptions),
      renderText: (value) => apiOptionLabel(articleSourceOptions, value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: optionValueEnum(articleWorkflowStatusOptions),
      renderText: (value) =>
        apiOptionLabel(articleWorkflowStatusOptions, value),
    },
    {
      title: '质量分',
      dataIndex: 'qualityScore',
      search: false,
      render: (_, row) => Number(row.qualityScore ?? 0).toFixed(1),
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
      render: (_, row) => {
        const buttons: ReactNode[] = [
          <Button key="detail" type="link" onClick={() => openDetail(row.id)}>
            详情
          </Button>,
        ];
        const status = row.status;
        if (status === 'normal') {
          buttons.push(
            <Button
              key="disable"
              type="link"
              danger
              onClick={() => openReview(row, 2)}
            >
              禁用
            </Button>,
          );
        } else if (status === 'disabled') {
          buttons.push(
            <Button
              key="approve"
              type="link"
              onClick={() => openReview(row, 1)}
            >
              恢复为正常
            </Button>,
          );
        } else if (status === 'draft' || status === 'pending_review') {
          buttons.push(
            <Button
              key="approve"
              type="link"
              onClick={() => openReview(row, 1)}
            >
              通过
            </Button>,
            <Button
              key="disable"
              type="link"
              danger
              onClick={() => openReview(row, 2)}
            >
              禁用
            </Button>,
          );
        }
        buttons.push(
          <Button key="review" type="link" onClick={() => openReview(row)}>
            调整状态
          </Button>,
        );
        return buttons;
      },
    },
  ];
  return (
    <PageContainer
      title="文章审核"
      subTitle="跨企业查看内容质量、审核记录和版本历史"
    >
      <ProTable<API.Article>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const pageSize = params.pageSize ?? 20;
          const reply = await articleServiceListArticles({
            pageSize,
            pageToken: pageTokenFor(params.current, pageSize),
            keyword: params.title,
            enterpriseId: params.enterpriseId,
            status: apiOptionValue(articleWorkflowStatusOptions, params.status),
            source: apiOptionValue(articleSourceOptions, params.source),
          });
          return {
            data: reply.items ?? [],
            total: Number(reply.totalSize ?? 0),
            success: true,
          };
        }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
      />
      <Drawer
        title="文章详情"
        width={860}
        open={Boolean(detail)}
        onClose={() => setDetail(undefined)}
      >
        {detail?.article && (
          <>
            <Descriptions
              column={2}
              bordered
              size="small"
              items={[
                {
                  key: 'enterprise',
                  label: '企业',
                  children: detail.article.enterpriseName,
                },
                {
                  key: 'brand',
                  label: '品牌',
                  children: detail.article.brandName,
                },
                {
                  key: 'type',
                  label: '文章类型',
                  children: detail.article.articleTypeName || '-',
                },
                {
                  key: 'status',
                  label: '状态',
                  children: (
                    <Tag>
                      {apiOptionLabel(
                        articleWorkflowStatusOptions,
                        detail.article.status,
                      )}
                    </Tag>
                  ),
                },
                {
                  key: 'score',
                  label: '质量分',
                  children: detail.article.qualityScore,
                },
                {
                  key: 'source',
                  label: '来源',
                  children: detail.article.source,
                },
              ]}
            />
            <Space style={{ marginTop: 16, marginBottom: 16 }}>
              <Button
                type="primary"
                onClick={() => openReview(detail.article)}
              >
                调整状态
              </Button>
            </Space>
            <Typography.Title level={4}>
              {detail.article.title}
            </Typography.Title>
            <Typography.Paragraph>
              {detail.article.summary}
            </Typography.Paragraph>
            <div className="article-detail-markdown">
              <XMarkdown>{detail.article.contentMarkdown}</XMarkdown>
            </div>
            <Typography.Title level={5}>审核记录</Typography.Title>
            <Timeline
              items={(detail.reviews ?? []).map((item) => ({
                children: (
                  <>
                    <b>{apiOptionLabel(articleReviewActionOptions, item.action) || item.action}</b>
                    ：{item.reason}（{apiOptionLabel(articleWorkflowStatusOptions, item.fromStatus) || item.fromStatus} →{' '}
                    {apiOptionLabel(articleWorkflowStatusOptions, item.toStatus) || item.toStatus}）
                  </>
                ),
              }))}
            />
          </>
        )}
      </Drawer>
      <ModalForm<ActionForm>
        key={selected?.id ?? 'empty'}
        title="调整文章状态"
        open={actionOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setActionOpen(false),
        }}
        initialValues={{ action: initialAction, reason: '' }}
        onFinish={async (values) => {
          if (!selected?.id) return false;
          await articleServiceReviewArticle(
            { id: selected.id },
            {
              id: selected.id,
              version: selected.version,
              action: apiOptionValue(articleReviewActionOptions, values.action),
              reason: values.reason,
            },
          );
          message.success('文章状态已更新');
          setActionOpen(false);
          actionRef.current?.reload();
          if (detail?.article?.id === selected.id) {
            openDetail(selected.id);
          }
          return true;
        }}
      >
        <ProFormSelect
          name="action"
          label="目标状态"
          rules={[{ required: true }]}
          options={articleReviewActionOptions}
        />
        <ProFormTextArea
          name="reason"
          label="操作说明"
          rules={[{ required: true }]}
        />
      </ModalForm>
    </PageContainer>
  );
}
