// @vitest-environment jsdom
import { FlowsheetValue, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, it, vi } from 'vitest';
import { chartPoint } from '../../src/features/flowsheets/chartPoints';
import {
  bothUnits,
  cellOf,
  rowLabel,
  rowsToShow,
  toColumns,
} from '../../src/features/flowsheets/components/Flowsheets';
import { FlowsheetRow, FLOWSHEETS } from '../../src/features/flowsheets/registry';

// The component imports the api client through its data hook; the formatting under test never calls it.
vi.mock('src/api/api', () => ({}));

const reading = (value: number | string, time = '2026-07-13T14:00:00.000Z'): FlowsheetValue => ({
  time,
  value,
  readings: [{ time, value }],
});

const visit = (values: Record<string, FlowsheetValue>): FlowsheetVisit => ({
  start: '2026-07-13T14:00:00.000Z',
  isFollowUp: false,
  reason: '',
  primaryDiagnosis: '',
  attending: '',
  values,
});

describe('flowsheet cell formatting', () => {
  it('shows exactly the row digits, keeping trailing zeros, in the cell and the hover readings', () => {
    const value: FlowsheetValue = {
      ...reading(3.1),
      readings: [
        { time: '2026-07-13T13:00:00.000Z', value: 3 },
        { time: '2026-07-13T14:00:00.000Z', value: 3.1 },
      ],
    };
    const cell = cellOf({ label: 'Weight (kg)', keys: ['weight'], digits: 2 }, visit({ weight: value }));
    expect(cell.text).toBe('3.10');
    expect(cell.history.map((h) => h.text)).toEqual(['3.00', '3.10']);
  });

  it('keeps one-decimal and integer rows as before', () => {
    expect(cellOf({ label: 'Weight (kg)', keys: ['weight'], digits: 1 }, visit({ weight: reading(3.1) })).text).toBe(
      '3.1'
    );
    expect(cellOf({ label: 'Weight (kg)', keys: ['weight'], digits: 1 }, visit({ weight: reading(3.14) })).text).toBe(
      '3.1'
    );
    expect(
      cellOf({ label: 'Heart rate (bpm)', keys: ['heartRate'], digits: 0 }, visit({ heartRate: reading(72.4) })).text
    ).toBe('72');
    expect(
      cellOf(
        { label: 'Blood pressure (mmHg)', keys: ['systolic', 'diastolic'], digits: 0 },
        visit({ systolic: reading(120), diastolic: reading(80) })
      ).text
    ).toBe('120/80');
  });

  it('shows text and unrounded numbers as saved', () => {
    expect(cellOf({ label: 'Drug', keys: ['drug'] }, visit({ drug: reading('warfarin 5 mg') })).text).toBe(
      'warfarin 5 mg'
    );
    expect(cellOf({ label: 'INR', keys: ['inr'] }, visit({ inr: reading(2.4) })).text).toBe('2.4');
  });
});

describe('flowsheet column labels', () => {
  it('marks an unlinked (unsolicited) result and a follow-up in the column label', () => {
    const [outside, followUp, plain] = toColumns([
      { ...visit({}), start: '2026-07-15T09:00:00.000Z', isOutsideResult: true },
      { ...visit({}), start: '2026-07-14T09:00:00.000Z', isFollowUp: true },
      visit({}),
    ]);
    expect(outside.label).toMatch(/ \(unsolicited result\)$/);
    expect(outside.url).toBeUndefined();
    expect(followUp.label).toMatch(/ \(follow-up\)$/);
    expect(plain.label).not.toMatch(/\(/);
  });
});

describe('rows hidden when empty (no BMI under 2)', () => {
  const growth = FLOWSHEETS.find((f) => f.id === 'growth')!;
  const labels = (visits: FlowsheetVisit[]): string[] =>
    rowsToShow(growth, visits).map((row) => ('heading' in row ? row.heading : row.label));

  it('drops the BMI rows when no visit has a BMI and keeps them once any visit does; Growth shows only rows with a value', () => {
    const infant = visit({ weight: reading(7.3), height: reading(65), weightForLengthPercentile: reading('60th') });
    expect(labels([infant])).not.toContain('BMI (kg/m²)');
    expect(labels([infant])).not.toContain('BMI percentile');
    expect(labels([infant])).toContain('Weight-for-length percentile');
    expect(labels([infant])).not.toContain('Head circumference (cm)');
    const child = visit({
      weight: reading(32),
      height: reading(138),
      bmi: reading(16.8),
      bmiPercentile: reading('55th'),
    });
    expect(labels([infant, child])).toContain('BMI (kg/m²)');
    expect(labels([infant, child])).toContain('BMI percentile');
  });
});

describe('growth measures in the practice header unit system', () => {
  const growth = FLOWSHEETS.find((f) => f.id === 'growth')!;
  const weight = growth.rows.find((row) => row.keys[0] === 'weight')!;
  const height = growth.rows.find((row) => row.keys[0] === 'height')!;
  const v = visit({ weight: reading(5.8), height: reading(65.04), weightPercentile: reading('60th') });

  it('shows metric by default and imperial when the practice header system is imperial, both on hover', () => {
    expect(cellOf(weight, v).text).toBe('5.80');
    expect(cellOf(weight, v, 'imperial').text).toBe('12.79');
    expect(cellOf(height, v, 'imperial').text).toBe('25.61');
    expect(rowLabel(weight)).toBe('Weight (kg)');
    expect(rowLabel(weight, 'imperial')).toBe('Weight (lbs)');
    expect(rowLabel(height, 'imperial')).toBe('Height / length (in)');
    expect(bothUnits(weight, 5.8)).toBe('5.80 kg ≈ 12.79 lbs');
    expect(bothUnits(height, 65.04)).toBe('65.0 cm ≈ 25.61 in');
    // Percentile and non-measure rows are not converted.
    const percentile = growth.rows.find((row) => row.keys[0] === 'weightPercentile')!;
    expect(cellOf(percentile, v, 'imperial').text).toBe('60th');
    expect(bothUnits(percentile, '60th')).toBeUndefined();
    expect(rowLabel(percentile, 'imperial')).toBe('Weight percentile');
  });
});

describe('Vitals, Thyroid and Newborn bilirubin measures in the practice header unit system', () => {
  const rowOf = (id: string, key: string): FlowsheetRow =>
    FLOWSHEETS.find((f) => f.id === id)!.rows.find((row) => row.keys[0] === key)!;
  const v = visit({ weight: reading(96.34), height: reading(175.3), headCircumference: reading(44.2) });

  it('shows weight, height and head circumference imperial when the practice header system is imperial', () => {
    expect(cellOf(rowOf('vitals', 'weight'), v, 'imperial').text).toBe('212.39');
    expect(rowLabel(rowOf('vitals', 'weight'), 'imperial')).toBe('Weight (lbs)');
    expect(cellOf(rowOf('vitals', 'height'), v, 'imperial').text).toBe('69.02');
    expect(rowLabel(rowOf('vitals', 'height'), 'imperial')).toBe('Height (in)');
    expect(rowLabel(rowOf('vitals', 'headCircumference'), 'imperial')).toBe('Head circumference (in)');
    expect(cellOf(rowOf('thyroid', 'weight'), v, 'imperial').text).toBe('212.39');
    expect(cellOf(rowOf('thyroid', 'weight'), v).text).toBe('96.34');
    expect(bothUnits(rowOf('thyroid', 'weight'), 96.34)).toBe('96.34 kg ≈ 212.39 lbs');
    expect(cellOf(rowOf('newbornBilirubin', 'weight'), visit({ weight: reading(3.25) }), 'imperial').text).toBe('7.17');
    expect(rowLabel(rowOf('newbornBilirubin', 'weight'), 'imperial')).toBe('Weight (lbs)');
    expect(bothUnits(rowOf('newbornBilirubin', 'weight'), 3.25)).toBe('3.25 kg ≈ 7.17 lbs');
  });

  it('shows a temperature in °C, with °F on hover as vitals history does', () => {
    const temperature = rowOf('vitals', 'temperature');
    expect(cellOf(temperature, visit({ temperature: reading(37) }), 'imperial').text).toBe('37.0');
    expect(bothUnits(temperature, 37)).toBe('37.0 C ≈ 98.6 F');
  });

  it('every weight chart switches to lbs when the practice header system is imperial', () => {
    const weightCharts = FLOWSHEETS.flatMap((f) => f.charts.filter((c) => c.lines.some((l) => l.key === 'weight')));
    expect(weightCharts.map((c) => [c.unit, c.imperialUnit])).toEqual([
      ['kg', 'lbs'],
      ['kg', 'lbs'],
    ]);
  });

  it('plots a weight in lbs on a chart in lbs', () => {
    expect(chartPoint(v, 'weight', false, 'lbs')).toEqual([Date.parse(v.start), 212.39]);
    expect(chartPoint(v, 'weight', false, 'kg')).toEqual([Date.parse(v.start), 96.34]);
  });
});
