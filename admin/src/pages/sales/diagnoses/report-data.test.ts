import { describe, expect, it } from 'vitest';
import {
  diagnosisLevelLabel,
  diagnosisPriorityLabel,
  diagnosisSourceTypeLabel,
  isOverallDiagnosisDimension,
} from './report-data';

describe('isOverallDiagnosisDimension', () => {
  it.each([undefined, '', 0, '0'])(
    'treats %j as the overall dimension',
    (value) => {
      expect(isOverallDiagnosisDimension(value)).toBe(true);
    },
  );

  it.each([1, '1', 42, '42'])('treats %j as a model dimension', (value) => {
    expect(isOverallDiagnosisDimension(value)).toBe(false);
  });

  it('renders customer-facing evidence and priority labels', () => {
    expect(diagnosisSourceTypeLabel(2)).toBe('官方信息源');
    expect(diagnosisSourceTypeLabel(99)).toBe('其他高权重信源');
    expect(diagnosisPriorityLabel(0)).toBe('P0');
    expect(diagnosisPriorityLabel(9)).toBe('P3');
    expect(diagnosisLevelLabel(3)).toBe('高');
  });
});
