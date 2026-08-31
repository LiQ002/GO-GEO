import { describe, expect, it } from 'vitest';
import { jsonFieldRule, pageTokenFor } from './admin-api';

describe('admin API helpers', () => {
  it('encodes the offset as the backend raw URL-safe page token', () => {
    expect(pageTokenFor(1, 20)).toBeUndefined();
    expect(pageTokenFor(3, 20)).toBe('NDA');
  });

  it('accepts valid JSON and rejects invalid JSON', async () => {
    await expect(
      jsonFieldRule(true).validator?.({}, '{"ok":true}', () => undefined),
    ).resolves.toBeUndefined();
    await expect(
      jsonFieldRule(true).validator?.({}, '{invalid}', () => undefined),
    ).rejects.toThrow(
      '请输入有效的 JSON',
    );
  });
});
