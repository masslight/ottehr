import { describe, expect, it } from 'vitest';
import { formatWeight, formatWeightKg, formatWeightLbs, kgToLbs, lbsToKg } from './vitals-weight.helper';

describe('weight display', () => {
  it('shows up to 2 decimals in kg and lbs', () => {
    expect(formatWeightKg(3.25)).toBe('3.25');
    expect(formatWeightKg(3.2)).toBe('3.2');
    expect(formatWeightKg(70)).toBe('70');
    expect(formatWeightLbs(3.25)).toBe('7.17');
    expect(formatWeight(8.886, 'kg')).toBe('8.89');
  });
});

describe('weight entered in lbs', () => {
  it('is saved in kg to 3 decimals, so it shows back as the lbs that were typed', () => {
    expect(lbsToKg(7.16)).toBe(3.248);
    expect(formatWeightLbs(lbsToKg(7.16))).toBe('7.16');
    expect(formatWeightLbs(lbsToKg(19.6))).toBe('19.6');
  });
});

describe('weight converted to lbs for reports and forms', () => {
  it('matches the lbs shown on the chart', () => {
    expect(kgToLbs(3.248)).toBe(7.16);
    expect(kgToLbs(3.25)).toBe(Number(formatWeightLbs(3.25)));
    expect(kgToLbs(77.111)).toBe(170);
  });
});
