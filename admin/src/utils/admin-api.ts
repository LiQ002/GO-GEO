import type { RuleObject } from 'antd/es/form';

export const pageTokenFor = (current = 1, pageSize = 20) => {
  const offset = Math.max(0, current - 1) * pageSize;
  if (offset === 0) return undefined;
  return window.btoa(String(offset)).replace(/=+$/u, '');
};

export const jsonFieldRule = (required = false): RuleObject => ({
  validator: async (_, value?: string) => {
    if (!value?.trim()) {
      if (required) throw new Error('请输入 JSON 配置');
      return;
    }
    try {
      JSON.parse(value);
    } catch {
      throw new Error('请输入有效的 JSON');
    }
  },
});
