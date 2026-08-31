import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { App, Button, Descriptions, Drawer, Image, Tag } from 'antd';
import { useRef, useState } from 'react';
import {
  realnameAuthenticationServiceApproveRealnameAuthentication,
  realnameAuthenticationServiceDeleteRealnameAuthentication,
  realnameAuthenticationServiceListRealnameAuthentications,
  realnameAuthenticationServiceRejectRealnameAuthentication,
} from '@/services/geo-admin/realnameAuthenticationService';
import { pageTokenFor } from '@/utils/admin-api';

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '待审核' },
  approved: { color: 'green', text: '已通过' },
  rejected: { color: 'red', text: '已驳回' },
};

export default function RealnameReviewPage() {
  const ref = useRef<ActionType | null>(null);
  const [detail, setDetail] = useState<any>();
  const [rejectOpen, setRejectOpen] = useState(false);
  const { message, modal } = App.useApp();

  const cols: ProColumns<any>[] = [
    { title: 'ID', dataIndex: ['authentication', 'id'], width: 60, search: false },
    {
      title: '认证类型',
      dataIndex: ['authentication', 'type'],
      width: 100,
      valueType: 'select',
      valueEnum: {
        personal: { text: '个人认证' },
        enterprise: { text: '企业认证' },
      },
      render: (_, record) => {
        const type = record?.authentication?.type;
        const text = type === 'enterprise' ? '企业认证' : type === 'personal' ? '个人认证' : type;
        const color = type === 'enterprise' ? 'blue' : 'default';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    { title: '实名企业', dataIndex: ['authentication', 'companyName'], width: 180 },
    { title: '认证人', dataIndex: ['authentication', 'realName'], width: 100 },
    {
      title: '营业执照',
      dataIndex: ['authentication', 'licenseImageUrl'],
      width: 100,
      search: false,
      render: (_, record) => {
        const url = record?.authentication?.licenseImageUrl;
        return url ? (
          <Image
            src={url}
            alt="营业执照"
            width={60}
            height={60}
            style={{ objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
          />
        ) : '-';
      },
    },
    {
      title: '认证人身份证',
      dataIndex: ['authentication', 'idCardImageUrl'],
      width: 100,
      search: false,
      render: (_, record) => {
        const url = record?.authentication?.idCardImageUrl;
        return url ? (
          <Image
            src={url}
            alt="身份证"
            width={60}
            height={60}
            style={{ objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
          />
        ) : '-';
      },
    },
    {
      title: '状态',
      dataIndex: ['authentication', 'status'],
      valueType: 'select',
      valueEnum: {
        pending: { text: '待审核', status: 'Warning' },
        approved: { text: '已通过', status: 'Success' },
        rejected: { text: '已驳回', status: 'Error' },
      },
      width: 100,
      render: (_, record) => {
        const status = record?.authentication?.status;
        const info = statusMap[status] || { color: 'default', text: status };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '提交时间',
      dataIndex: ['authentication', 'submittedAt'],
      valueType: 'dateTime',
      search: false,
      width: 160,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 260,
      fixed: 'right',
      render: (_, record) => {
        const status = record?.authentication?.status;
        const id = record?.authentication?.id;
        return [
          <Button
            key="detail"
            type="link"
            onClick={() => setDetail(record)}
          >
            详情
          </Button>,
          status === 'pending' ? (
            <Button
              key="approve"
              type="link"
              style={{ color: '#52c41a' }}
              onClick={async () => {
                if (!id) return;
                await realnameAuthenticationServiceApproveRealnameAuthentication({ id }, {});
                message.success('审核通过成功');
                ref.current?.reload();
              }}
            >
              通过
            </Button>
          ) : null,
          status === 'pending' || status === 'approved' ? (
            <Button
              key="reject"
              type="link"
              danger
              onClick={() => {
                setDetail(record);
                setRejectOpen(true);
              }}
            >
              驳回
            </Button>
          ) : null,
          <Button
            key="delete"
            type="link"
            danger
            onClick={() => {
              if (!id) return;
              modal.confirm({
                title: '确认删除',
                content: '确定要删除这条实名认证记录吗？',
                onOk: async () => {
                  await realnameAuthenticationServiceDeleteRealnameAuthentication({ id });
                  message.success('删除成功');
                  ref.current?.reload();
                },
              });
            }}
          >
            删除
          </Button>,
        ];
      },
    },
  ];

  return (
    <PageContainer title="实名审核">
      <ProTable<any>
        rowKey={(record) => record?.authentication?.id || ''}
        actionRef={ref}
        columns={cols}
        scroll={{ x: 1200 }}
        request={async (p) => {
          const size = p.pageSize ?? 20;
          const r = await realnameAuthenticationServiceListRealnameAuthentications({
            pageSize: size,
            pageToken: pageTokenFor(p.current, size),
            keyword: p.keyword,
            status: p.status,
            type: p.type,
          });
          return {
            data: r.items ?? [],
            total: Number(r.totalSize ?? 0),
            success: true,
          };
        }}
      />
      <Drawer
        title="实名认证详情"
        width={680}
        open={Boolean(detail)}
        onClose={() => {
          setDetail(undefined);
          setRejectOpen(false);
        }}
      >
        {detail && detail.authentication && (
          <>
            <Descriptions
              bordered
              column={2}
              items={[
                { key: 'id', label: 'ID', children: detail.authentication.id },
                { key: 'type', label: '认证类型', children: detail.authentication.type === 'enterprise' ? '企业认证' : detail.authentication.type === 'personal' ? '个人认证' : detail.authentication.type },
                {
                  key: 'status',
                  label: '状态',
                  children: (
                    <Tag color={statusMap[detail.authentication.status]?.color}>
                      {statusMap[detail.authentication.status]?.text}
                    </Tag>
                  ),
                },
                { key: 'enterpriseName', label: '企业名称', children: detail.enterpriseName || detail.authentication.companyName || '-' },
                { key: 'companyName', label: '认证人', children: detail.authentication.realName },
                { key: 'registrationNo', label: '身份证号', children: detail.authentication.idCardNumber },
                { key: 'mobile', label: '手机号', children: detail.authentication.mobile },
                { key: 'username', label: '账号', children: detail.username },
                ...(detail.authentication.rejectReason ? [
                  { key: 'rejectReason', label: '驳回原因', children: detail.authentication.rejectReason, span: 2 },
                ] : []),
                {
                  key: 'submittedAt',
                  label: '提交时间',
                  children: detail.authentication.submittedAt ? new Date(detail.authentication.submittedAt).toLocaleString('zh-CN') : '-',
                },
                {
                  key: 'reviewedAt',
                  label: '审核时间',
                  children: detail.authentication.reviewedAt ? new Date(detail.authentication.reviewedAt).toLocaleString('zh-CN') : '-',
                },
              ]}
            />
            {detail.authentication.licenseImageUrl && (
              <div style={{ marginTop: 16 }}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>营业执照图片</div>
                <Image
                  src={detail.authentication.licenseImageUrl}
                  alt="营业执照"
                  style={{ maxWidth: 300 }}
                />
              </div>
            )}
            {detail.authentication.idCardImageUrl && (
              <div style={{ marginTop: 16 }}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>认证人身份证图片</div>
                <Image
                  src={detail.authentication.idCardImageUrl}
                  alt="身份证"
                  style={{ maxWidth: 300 }}
                />
              </div>
            )}
            {(detail.authentication.status === 'pending' || detail.authentication.status === 'approved') && (
              <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <Button
                  danger
                  onClick={() => setRejectOpen(true)}
                >
                  驳回
                </Button>
                {detail.authentication.status === 'pending' && (
                  <Button
                    type="primary"
                    onClick={async () => {
                      const id = detail.authentication.id;
                      await realnameAuthenticationServiceApproveRealnameAuthentication({ id }, {});
                      message.success('审核通过成功');
                      setDetail(undefined);
                      ref.current?.reload();
                    }}
                  >
                    通过
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </Drawer>
      <ModalForm<{ rejectReason: string }>
        title="驳回实名认证"
        open={rejectOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setRejectOpen(false),
        }}
        onFinish={async (v) => {
          if (!detail?.authentication?.id) return false;
          await realnameAuthenticationServiceRejectRealnameAuthentication(
            { id: detail.authentication.id },
            { id: detail.authentication.id, rejectReason: v.rejectReason },
          );
          message.success('驳回成功');
          setRejectOpen(false);
          setDetail(undefined);
          ref.current?.reload();
          return true;
        }}
      >
        <ProFormTextArea
          name="rejectReason"
          label="驳回原因"
          rules={[{ required: true, message: '请输入驳回原因' }]}
          placeholder="请输入驳回原因"
        />
      </ModalForm>
    </PageContainer>
  );
}
