import { describe, expect, it } from 'vitest';
import { addDays, addDuration, ageInYears, daysBetween, parseDuration } from './dates';

describe('CDSi date calculations (logic spec 3.4)', () => {
  it('parses CDSi durations', () => {
    expect(parseDuration('6 weeks - 4 days')).toEqual({ years: 0, months: 0, days: 38 });
    expect(parseDuration('3 months + 4 weeks')).toEqual({ years: 0, months: 3, days: 28 });
    expect(parseDuration('16 years - 4 months')).toEqual({ years: 16, months: -4, days: 0 });
    expect(parseDuration('8 months + 1 day')).toEqual({ years: 0, months: 8, days: 1 });
    expect(parseDuration('0 days')).toEqual({ years: 0, months: 0, days: 0 });
    expect(() => parseDuration('soon')).toThrow();
  });

  it('CALCDT-1/2/3: adds years, months and days holding the other parts constant', () => {
    expect(addDuration('2000-01-01', '3 years')).toBe('2003-01-01');
    expect(addDuration('2000-01-01', '6 months')).toBe('2000-07-01');
    expect(addDuration('2000-11-01', '6 months')).toBe('2001-05-01');
    expect(addDuration('2000-01-01', '3 days')).toBe('2000-01-04');
    expect(addDuration('2000-01-01', '3 weeks')).toBe('2000-01-22');
    expect(addDuration('2000-02-01', '5 weeks')).toBe('2000-03-07');
    expect(addDuration('2001-02-01', '5 weeks')).toBe('2001-03-08');
  });

  it('CALCDT-4: subtracts days', () => {
    expect(addDuration('2000-01-15', '0 days - 4 days')).toBe('2000-01-11');
    expect(addDays('2000-01-15', -4)).toBe('2000-01-11');
  });

  it('CALCDT-5: a day that does not exist moves to the first of the next month', () => {
    expect(addDuration('2000-03-31', '6 months')).toBe('2000-10-01');
    expect(addDuration('2000-08-31', '6 months')).toBe('2001-03-01');
    expect(addDuration('2023-01-31', '1 month')).toBe('2023-03-01');
  });

  it('CALCDT-6: years, then months, then days', () => {
    expect(addDuration('2000-01-31', '6 months - 4 days')).toBe('2000-07-27');
    expect(addDuration('2010-02-28', '16 years - 4 months')).toBe('2025-10-28');
  });

  it('helpers', () => {
    expect(daysBetween('2026-07-08', '2026-11-10')).toBe(125);
    expect(ageInYears('2021-09-14', '2026-09-13')).toBe(4);
    expect(ageInYears('2021-09-14', '2026-09-14')).toBe(5);
  });
});
