import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProFormCheckbox,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { App, Button, Form, Input, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
import { useMemo, useRef, useState } from 'react';
import {
  systemSettingServiceCreateSystemSetting,
  systemSettingServiceDeleteSystemSetting,
  systemSettingServiceListSystemSettings,
  systemSettingServiceUpdateSystemSetting,
} from '@/services/geo-admin/systemSettingService';
import { jsonFieldRule, pageTokenFor } from '@/utils/admin-api';

type SettingForm = {
  namespace: string;
  key: string;
  valueJson: string;
  description?: string;
  sensitive?: boolean;
  reason: string;
};

// 已有专门管理页的配置项：在通用列表里隐藏，避免重复编辑原始 JSON 绕过业务校验。
// 新增此类项时，配套在下方 toolBarRender 加入对应的"前往 xxx 配置"跳转按钮（自动去重）。
const HIDDEN_CONFIGS: Array<{ namespace: string; key: string; redirectTo: string; redirectLabel: string }> = [
  { namespace: 'billing', key: 'unit_costs', redirectTo: '/system/billing-config', redirectLabel: '前往计费配置' },
  { namespace: 'billing', key: 'action_registry', redirectTo: '/system/billing-config', redirectLabel: '前往计费配置' },
];

// 已知命名空间下拉项（筛选/新建时给提示，避免拼错）。
const NAMESPACE_OPTIONS = ['billing', 'citation'];

// 键值对映射类配置：把原始 JSON 包装成可增删的"键 → 值"行编辑器。
// 新增此类配置时，在下方数组注册即可，编辑器会自动切换 UI。
const KEY_VALUE_CONFIGS: Array<{ namespace: string; key: string; keyLabel: string; valueLabel: string }> = [
  { namespace: 'citation', key: 'domain_names', keyLabel: '域名', valueLabel: '中文名' },
];

const isHidden = (ns?: string, key?: string) =>
  HIDDEN_CONFIGS.some((c) => c.namespace === ns && c.key === key);

const findKeyValueConfig = (ns?: string, key?: string) =>
  KEY_VALUE_CONFIGS.find((c) => c.namespace === ns && c.key === key);

// 美化 JSON 字符串；解析失败时原样返回。
const prettyJson = (raw: string | undefined): string => {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};

// 行数据：key 为业务字段，uid 为 React 列表稳定 key（避免用 idx）。
type MapRow = { key: string; value: string; uid: string };

// 用自增计数器生成 uid，保证一次会话内 uid 不重复。
let mapRowUid = 0;
const nextUid = () => `kv-${++mapRowUid}`;

// 把对象解析为按 key 排序的行数组，解析失败返回空数组。
const parseMapRows = (raw: string | undefined): MapRow[] => {
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .map((k) => ({ key: k, value: typeof obj[k] === 'string' ? String(obj[k]) : JSON.stringify(obj[k]), uid: nextUid() }));
  } catch {
    return [];
  }
};

// 把行数组序列化为 {"k":"v"} 格式 JSON 字符串（空 key 自动跳过）。
const serializeMapRows = (rows: MapRow[]): string => {
  const obj: Record<string, string> = {};
  rows.forEach((r) => {
    if (r.key) obj[r.key] = r.value;
  });
  return JSON.stringify(obj, null, 2);
};

/**
 * 键值对映射编辑器：作为 antd Form.Item 的子组件使用，
 * 接收 value（JSON 字符串）和 onChange（回写 JSON 字符串）。
 * 内部把 JSON 解析为可增删的行表单，提交前由 Form.Item 自动同步到 valueJson 字段。
 */
function KVMapEditor({
  value,
  onChange,
  keyLabel,
  valueLabel,
}: {
  value?: string;
  onChange?: (v: string) => void;
  keyLabel: string;
  valueLabel: string;
}) {
  const rows = useMemo(() => parseMapRows(value), [value]);
  const emit = (next: MapRow[]) => {
    onChange?.(serializeMapRows(next));
  };
  return (
    <div>
      {rows.map((row, idx) => (
        <Space key={row.uid} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
          <Input
            placeholder={keyLabel}
            style={{ width: 240 }}
            value={row.key}
            onChange={(e) => {
              const next = rows.slice();
              next[idx] = { ...next[idx], key: e.target.value };
              emit(next);
            }}
          />
          <Typography.Text type="secondary">→</Typography.Text>
          <Input
            placeholder={valueLabel}
            style={{ width: 240 }}
            value={row.value}
            onChange={(e) => {
              const next = rows.slice();
              next[idx] = { ...next[idx], value: e.target.value };
              emit(next);
            }}
          />
          <MinusCircleOutlined
            style={{ color: '#ff4d4f' }}
            onClick={() => {
              const next = rows.slice();
              next.splice(idx, 1);
              emit(next);
            }}
          />
        </Space>
      ))}
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={() => emit([...rows, { key: '', value: '', uid: nextUid() }])}
        block
      >
        新增一行
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const ref = useRef<ActionType | null>(null);
  const [editing, setEditing] = useState<API.SystemSetting>();
  const [open, setOpen] = useState(false);
  const { message } = App.useApp();
  // namespace 候选值，从已加载数据动态扩充。
  const [namespaceOptions, setNamespaceOptions] = useState<string[]>(NAMESPACE_OPTIONS);

  const cols: ProColumns<API.SystemSetting>[] = [
    {
      title: '命名空间',
      dataIndex: 'namespace',
      valueType: 'select',
      valueEnum: useMemo(() => {
        const map: Record<string, { text: string }> = {};
        namespaceOptions.forEach((n) => {
          map[n] = { text: n };
        });
        return map;
      }, [namespaceOptions]),
      width: 120,
    },
    { title: '配置键', dataIndex: 'key', width: 180 },
    {
      title: '配置值',
      dataIndex: 'valueJson',
      search: false,
      // 截断展示单行 JSON，鼠标 hover 看完整美化内容。
      render: (_, v) => (
        <Tooltip
          title={
            <Typography.Text code style={{ whiteSpace: 'pre', fontSize: 12 }}>
              {prettyJson(v.valueJson)}
            </Typography.Text>
          }
          overlayStyle={{ maxWidth: 640 }}
        >
          <Typography.Text code style={{ maxWidth: 360 }} ellipsis>
            {v.valueJson}
          </Typography.Text>
        </Tooltip>
      ),
    },
    {
      title: '敏感',
      dataIndex: 'sensitive',
      search: false,
      width: 80,
      render: (_, v) => (v.sensitive ? <Tag color="warning">已脱敏</Tag> : '否'),
    },
    { title: '说明', dataIndex: 'description', search: false, ellipsis: true },
    { title: '版本', dataIndex: 'version', search: false, width: 70 },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      render: (_, v) => [
        <Button
          key="edit"
          type="link"
          onClick={() => {
            setEditing(v);
            setOpen(true);
          }}
        >
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="确认删除配置？"
          onConfirm={async () => {
            if (!v.id) return;
            await systemSettingServiceDeleteSystemSetting({
              id: v.id,
              version: v.version,
              reason: '平台管理员删除配置',
            });
            message.success('配置已删除');
            ref.current?.reload();
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
    <PageContainer title="系统配置" subTitle="敏感配置值不会通过管理接口回显">
      <ProTable<API.SystemSetting>
        rowKey="id"
        actionRef={ref}
        columns={cols}
        search={{ labelWidth: 80 }}
        request={async (p) => {
          const size = p.pageSize ?? 20;
          const r = await systemSettingServiceListSystemSettings({
            pageSize: size,
            pageToken: pageTokenFor(p.current, size),
            namespace: p.namespace,
            keyword: p.key,
          });
          // 前端过滤掉已有专门管理页的配置项，避免在通用页直接编辑原始 JSON 绕过业务校验。
          const raw = r.items ?? [];
          const items = raw.filter((it) => !isHidden(it.namespace, it.key));
          // 把命中的 namespace 合并进下拉选项，方便后续筛选。
          setNamespaceOptions((prev) => {
            const seen = new Set(prev);
            raw.forEach((it) => {
              if (it.namespace) seen.add(it.namespace);
            });
            const merged = Array.from(seen);
            return merged.length === prev.length ? prev : merged;
          });
          return {
            data: items,
            total: Math.max(0, Number(r.totalSize ?? 0) - (raw.length - items.length)),
            success: true,
          };
        }}
        toolBarRender={() => {
          // 已有专门管理页的配置项快捷入口（按 redirectTo 去重，与 HIDDEN_CONFIGS 对应）。
          const shortcuts = HIDDEN_CONFIGS.reduce<{ label: string; to: string }[]>(
            (acc, c) => {
              if (!acc.some((x) => x.to === c.redirectTo)) {
                acc.push({ label: c.redirectLabel, to: c.redirectTo });
              }
              return acc;
            },
            [],
          );
          return [
            ...shortcuts.map((c) => (
              <Button key={c.to} onClick={() => history.push(c.to)}>
                {c.label}
              </Button>
            )),
            <Button
              key="new"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(undefined);
                setOpen(true);
              }}
            >
              新增配置
            </Button>,
          ];
        }}
      />
      <ModalForm<SettingForm>
        title={editing ? '编辑配置' : '新增配置'}
        open={open}
        modalProps={{ destroyOnHidden: true, onCancel: () => setOpen(false) }}
        initialValues={editing ?? { valueJson: '{}', sensitive: false }}
        onFinish={async (v) => {
          const setting = {
            ...editing,
            namespace: v.namespace,
            key: v.key,
            valueJson: v.valueJson,
            description: v.description,
            sensitive: v.sensitive,
          };
          if (editing?.id)
            await systemSettingServiceUpdateSystemSetting(
              { 'setting.id': editing.id },
              { setting, reason: v.reason },
            );
          else
            await systemSettingServiceCreateSystemSetting({
              setting,
              reason: v.reason,
            });
          message.success('配置已保存');
          setOpen(false);
          setEditing(undefined);
          ref.current?.reload();
          return true;
        }}
      >
        <ProFormSelect
          name="namespace"
          label="命名空间"
          options={namespaceOptions.map((n) => ({ label: n, value: n }))}
          showSearch
          rules={[{ required: true }]}
          fieldProps={{ allowClear: false }}
        />
        <ProFormText name="key" label="配置键" rules={[{ required: true }]} />
        {/* 根据 namespace + key 切换编辑器：键值对映射走结构化表格，其他走原始 JSON textarea */}
        <ProFormDependency name={['namespace', 'key']}>
          {({ namespace, key }) => {
            const cfg = findKeyValueConfig(namespace, key);
            if (cfg) {
              return (
                <Form.Item
                  name="valueJson"
                  label={`${cfg.keyLabel} → ${cfg.valueLabel} 映射`}
                  tooltip={`结构化编辑：保存时自动序列化为 JSON；对应原始字段 value_json`}
                  rules={[{ required: true, message: '至少配置一行映射' }]}
                >
                  <KVMapEditor keyLabel={cfg.keyLabel} valueLabel={cfg.valueLabel} />
                </Form.Item>
              );
            }
            return (
              <ProFormTextArea
                name="valueJson"
                label={editing?.sensitive ? '新配置值 JSON（需重新填写）' : '配置值 JSON'}
                fieldProps={{ rows: 8 }}
                rules={[{ required: true }, jsonFieldRule(true)]}
              />
            );
          }}
        </ProFormDependency>
        <ProFormTextArea name="description" label="说明" />
        <ProFormCheckbox name="sensitive">
          敏感配置（接口只返回脱敏值）
        </ProFormCheckbox>
        <ProFormTextArea
          name="reason"
          label="变更原因"
          rules={[{ required: true }]}
        />
      </ModalForm>
    </PageContainer>
  );
}
