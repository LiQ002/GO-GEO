import { describe, expect, it } from 'vitest';
import {
  SalesOpportunityStatus,
  salesOpportunityStatusLabel,
  salesOpportunityStatusValueEnum,
} from './sales-enums';

describe('sales opportunity enums', () => {
  it('uses backend numeric values and Chinese labels', () => {
    expect(SalesOpportunityStatus.following).toBe(1);
    expect(salesOpportunityStatusLabel(2)).toBe('已暂停');
    expect(salesOpportunityStatusValueEnum()[3]?.text).toBe('已关闭');
  });
});
