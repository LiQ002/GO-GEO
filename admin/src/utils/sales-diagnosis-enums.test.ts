import { describe, expect, it } from 'vitest';
import {
  SalesDiagnosisSubjectType,
  salesDiagnosisSubjectTypeLabel,
} from './sales-diagnosis-enums';

describe('sales diagnosis subject enums', () => {
  it('shows the quick brand diagnosis subject in Chinese', () => {
    expect(
      salesDiagnosisSubjectTypeLabel(SalesDiagnosisSubjectType.quickBrand),
    ).toBe('快速品牌诊断');
  });
});
