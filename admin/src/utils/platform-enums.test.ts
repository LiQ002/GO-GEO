import { describe, expect, it } from 'vitest';
import {
  apiOptionLabel,
  apiOptionValue,
  articleWorkflowStatusOptions,
  planMetricOptions,
} from './platform-enums';

describe('platform numeric enums', () => {
  it('uses positive numeric values for stored configuration options', () => {
    expect(planMetricOptions.every((option) => option.value > 0)).toBe(true);
    expect(new Set(planMetricOptions.map((option) => option.value)).size).toBe(
      planMetricOptions.length,
    );
  });

  it('converts workflow filter values without exposing English codes', () => {
    expect(apiOptionValue(articleWorkflowStatusOptions, 2)).toBe(
      'pending_review',
    );
    expect(apiOptionLabel(articleWorkflowStatusOptions, 'pending_review')).toBe(
      '待审核',
    );
  });
});
