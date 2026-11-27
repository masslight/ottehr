import { chartPointsOf, timeTickLabel, yAxisBounds } from 'src/features/flowsheets/chart';
import {
  cellOf,
  describeReading,
  formatFixed,
  measureLabel,
  toColumns,
  visitTypeLabel,
} from 'src/features/flowsheets/format';
import { FlowsheetChart, FlowsheetMeasure, FLOWSHEETS } from 'src/features/flowsheets/registry';
import { VitalAlertCriticality, VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { FlowsheetMeasureKey, FlowsheetValues, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { ServiceMode } from 'utils/lib/types/common';
import { describe, expect, it } from 'vitest';

const vitals = FLOWSHEETS[0];
const row = (key: FlowsheetMeasureKey): FlowsheetMeasure => vitals.rows.find((r) => r.key === key)!;
const chart = (key: FlowsheetMeasureKey): FlowsheetChart => vitals.charts.find((c) => c.key === key)!;

const visit = (start: string, values: FlowsheetValues = {}, extra: Partial<FlowsheetVisit> = {}): FlowsheetVisit => ({
  start,
  isFollowUp: false,
  reason: '',
  primaryDiagnosis: '',
  provider: '',
  values,
  ...extra,
});

const MORNING = '2026-03-14T09:12:00';

describe('formatFixed', () => {
  it('rounds half up without floating-point error', () => {
    expect(formatFixed(2.345, 2)).toBe('2.35');
    expect(formatFixed(1.005, 2)).toBe('1.01');
    expect(formatFixed(2.344, 2)).toBe('2.34');
  });

  it('keeps the fixed decimals of a whole number', () => {
    expect(formatFixed(37, 1)).toBe('37.0');
    expect(formatFixed(80, 2)).toBe('80.00');
    expect(formatFixed(92, 0)).toBe('92');
  });
});

describe('the Vitals rows', () => {
  it('are listed in the order of the requirements, in the unit of the switch', () => {
    expect(vitals.rows.map((r) => measureLabel(r, 'metric'))).toEqual([
      'Temperature (°C)',
      'Heart rate (/min)',
      'Respiratory rate (/min)',
      'SpO₂ (%)',
      'Blood pressure (mm Hg)',
      'Weight (kg)',
      'Height (cm)',
      'Head circumference (cm)',
      'BMI (kg/m²)',
    ]);
    expect(vitals.rows.map((r) => measureLabel(r, 'imperial'))).toEqual([
      'Temperature (°F)',
      'Heart rate (/min)',
      'Respiratory rate (/min)',
      'SpO₂ (%)',
      'Blood pressure (mm Hg)',
      'Weight (lbs)',
      'Height (in)',
      'Head circumference (in)',
      'BMI (kg/m²)',
    ]);
  });
});

describe('cellOf', () => {
  it('is empty for a visit without the measure', () => {
    expect(cellOf(row(VitalFieldNames.VitalWeight), visit(MORNING), 'metric')).toBeUndefined();
  });

  it('shows the latest reading with the count of the others and takes the latest flag', () => {
    const cell = cellOf(
      row(VitalFieldNames.VitalHeartbeat),
      visit(MORNING, {
        [VitalFieldNames.VitalHeartbeat]: [
          { time: '2026-03-14T14:00:00', values: [140], flag: VitalAlertCriticality.Abnormal },
          { time: '2026-03-14T14:10:00', values: [92] },
        ],
      }),
      'metric'
    );
    expect(cell).toEqual({
      text: '92',
      flag: undefined,
      moreCount: 1,
      hoverLines: ['03/14/2026 2:00 PM 140 /min abnormal', '03/14/2026 2:10 PM 92 /min'],
    });
  });

  it('converts the saved value and rounds once', () => {
    const weight = visit(MORNING, { [VitalFieldNames.VitalWeight]: [{ time: MORNING, values: [5.8] }] });
    expect(cellOf(row(VitalFieldNames.VitalWeight), weight, 'metric')?.text).toBe('5.80');
    expect(cellOf(row(VitalFieldNames.VitalWeight), weight, 'imperial')?.text).toBe('12.79');
    const temperature = visit(MORNING, { [VitalFieldNames.VitalTemperature]: [{ time: MORNING, values: [37] }] });
    expect(cellOf(row(VitalFieldNames.VitalTemperature), temperature, 'metric')?.text).toBe('37.0');
    expect(cellOf(row(VitalFieldNames.VitalTemperature), temperature, 'imperial')?.text).toBe('98.6');
    const height = visit(MORNING, { [VitalFieldNames.VitalHeight]: [{ time: MORNING, values: [178] }] });
    expect(cellOf(row(VitalFieldNames.VitalHeight), height, 'metric')?.text).toBe('178.0');
    expect(cellOf(row(VitalFieldNames.VitalHeight), height, 'imperial')?.text).toBe('70.08');
  });

  it('converts a temperature from the saved value, not from a rounded one', () => {
    const temperature = visit(MORNING, { [VitalFieldNames.VitalTemperature]: [{ time: MORNING, values: [36.472] }] });
    expect(cellOf(row(VitalFieldNames.VitalTemperature), temperature, 'imperial')?.text).toBe('97.6');
  });

  it('shows a saved 2.345 kg as 2.35', () => {
    const weight = visit(MORNING, { [VitalFieldNames.VitalWeight]: [{ time: MORNING, values: [2.345] }] });
    expect(cellOf(row(VitalFieldNames.VitalWeight), weight, 'metric')?.text).toBe('2.35');
  });

  it('reads a blood pressure as systolic/diastolic', () => {
    const pressure = visit(MORNING, {
      [VitalFieldNames.VitalBloodPressure]: [
        { time: MORNING, values: [120, 80], flag: VitalAlertCriticality.Critical },
      ],
    });
    expect(cellOf(row(VitalFieldNames.VitalBloodPressure), pressure, 'metric')).toEqual({
      text: '120/80',
      flag: VitalAlertCriticality.Critical,
      moreCount: 0,
      hoverLines: ['03/14/2026 9:12 AM 120/80 mm Hg critical'],
    });
  });
});

describe('describeReading', () => {
  it("shows both units of a convertible measure, the switch's unit first", () => {
    const reading = { time: MORNING, values: [80], flag: VitalAlertCriticality.Abnormal };
    expect(describeReading(row(VitalFieldNames.VitalWeight), reading, 'metric')).toBe(
      '03/14/2026 9:12 AM 80.00 kg ≈ 176.37 lbs abnormal'
    );
    expect(describeReading(row(VitalFieldNames.VitalWeight), reading, 'imperial')).toBe(
      '03/14/2026 9:12 AM 176.37 lbs ≈ 80.00 kg abnormal'
    );
  });

  it('writes temperatures with C and F, as the Vitals history does', () => {
    const reading = { time: MORNING, values: [37] };
    expect(describeReading(row(VitalFieldNames.VitalTemperature), reading, 'metric')).toBe(
      '03/14/2026 9:12 AM 37.0 C ≈ 98.6 F'
    );
    expect(describeReading(row(VitalFieldNames.VitalTemperature), reading, 'imperial')).toBe(
      '03/14/2026 9:12 AM 98.6 F ≈ 37.0 C'
    );
  });

  it('shows one unit for a measure that has no other', () => {
    expect(describeReading(row(VitalFieldNames.VitalBMI), { time: MORNING, values: [23.44] }, 'imperial')).toBe(
      '03/14/2026 9:12 AM 23.4 kg/m²'
    );
  });
});

describe('toColumns', () => {
  it('labels a column by its date, adding the time only when two columns share a day', () => {
    const columns = toColumns([
      visit('2026-11-14T14:05:00'),
      visit('2026-11-14T08:14:00'),
      visit('2026-09-03T10:00:00'),
    ]);
    expect(columns.map((column) => column.label)).toEqual(['11/14/2026 2:05 PM', '11/14/2026 8:14 AM', '09/03/2026']);
  });

  it('marks a follow-up and links it through its original visit', () => {
    const followUp = { isFollowUp: true, encounterId: 'fu1', appointmentId: 'a1', originalAppointmentId: 'a0' };
    const [scheduled, annotation, orphan] = toColumns([
      visit('2026-11-16T16:00:00', {}, { ...followUp, followupSubtype: 'scheduled' }),
      visit('2026-11-15T16:00:00', {}, { ...followUp, followupSubtype: 'annotation' }),
      visit('2026-11-13T16:00:00', {}, { ...followUp, originalAppointmentId: undefined }),
    ]);
    expect(scheduled.label).toBe('11/16/2026 (follow-up)');
    expect(scheduled.url).toBe('/in-person/a0/review-and-sign?encounterId=fu1');
    expect(annotation.url).toBe('/in-person/a0/follow-up-note?encounterId=fu1');
    expect(orphan.url).toBeUndefined();
  });

  it("links a visit to its Review & Sign screen and marks the opened visit's own column", () => {
    const columns = toColumns(
      [
        visit('2026-11-16T16:00:00', {}, { appointmentId: 'a1', encounterId: 'fu1', isFollowUp: true }),
        visit('2026-11-14T08:14:00', {}, { appointmentId: 'a1', encounterId: 'e1' }),
        visit('2026-09-03T10:00:00', {}, { appointmentId: 'a2', encounterId: 'e2' }),
        visit('2025-12-01T09:00:00'),
      ],
      'e1'
    );
    expect(columns.map((column) => column.isCurrent)).toEqual([false, true, false, false]);
    expect(columns[1].url).toBe('/in-person/a1/review-and-sign');
    expect(columns[3].url).toBeUndefined();
  });
});

describe('visitTypeLabel', () => {
  const resolve = (code?: string): string | undefined => (code === 'urgent-care' ? 'UC' : undefined);

  it('reads as the Visits tab does', () => {
    expect(
      visitTypeLabel(visit(MORNING, {}, { appointmentType: 'pre-booked', serviceMode: ServiceMode.virtual }), resolve)
    ).toBe('Pre-booked Telemed');
    expect(
      visitTypeLabel(
        visit(
          MORNING,
          {},
          { appointmentType: 'walk-in', serviceMode: ServiceMode['in-person'], serviceCategory: 'urgent-care' }
        ),
        resolve
      )
    ).toBe('Walk-in In Person Visit / UC');
    expect(
      visitTypeLabel(
        visit(MORNING, {}, { isFollowUp: true, followUpType: 'Follow-up Encounter', serviceCategory: 'urgent-care' }),
        resolve
      )
    ).toBe('Follow-up Encounter / UC');
    expect(visitTypeLabel(visit(MORNING), resolve)).toBe('-');
  });
});

describe('the Vitals trend charts', () => {
  it('are listed in the order of the requirements', () => {
    expect(vitals.charts.map((c) => measureLabel(c, 'metric'))).toEqual([
      'Heart rate (/min)',
      'Respiratory rate (/min)',
      'SpO₂ (%)',
      'Temperature (°C)',
      'Weight (kg)',
      'BMI (kg/m²)',
      'Blood pressure (mm Hg)',
    ]);
    expect(chart(VitalFieldNames.VitalBloodPressure).lines).toEqual(['Systolic', 'Diastolic']);
  });

  it('plot one point per visit: its latest reading, oldest visit first', () => {
    const visits = [
      visit('2026-03-14T14:00:00', {
        [VitalFieldNames.VitalHeartbeat]: [
          { time: '2026-03-14T14:00:00', values: [140], flag: VitalAlertCriticality.Abnormal },
          { time: '2026-03-14T14:10:00', values: [92] },
        ],
      }),
      visit('2026-02-01T10:00:00'),
      visit('2026-01-10T10:00:00', {
        [VitalFieldNames.VitalHeartbeat]: [{ time: '2026-01-10T10:05:00', values: [70] }],
      }),
    ];
    const [line] = chartPointsOf(chart(VitalFieldNames.VitalHeartbeat), visits, 'metric');
    expect(line.map((point) => [point.visitIndex, point.y, point.flag])).toEqual([
      [2, 70, undefined],
      [0, 92, undefined],
    ]);
    expect(line[1].tooltip).toBe('03/14/2026 2:10 PM · 92 /min');
  });

  it('follow the switch: a weight point in lbs with both units on hover', () => {
    const visits = [
      visit(MORNING, {
        [VitalFieldNames.VitalWeight]: [{ time: MORNING, values: [80], flag: VitalAlertCriticality.Abnormal }],
      }),
    ];
    const [[point]] = chartPointsOf(chart(VitalFieldNames.VitalWeight), visits, 'imperial');
    expect(point.y).toBe(176.37);
    expect(point.tooltip).toBe('03/14/2026 9:12 AM · 176.37 lbs ≈ 80.00 kg · abnormal');
  });

  it('draw a blood pressure as two lines sharing one hover', () => {
    const visits = [visit(MORNING, { [VitalFieldNames.VitalBloodPressure]: [{ time: MORNING, values: [120, 80] }] })];
    const [systolic, diastolic] = chartPointsOf(chart(VitalFieldNames.VitalBloodPressure), visits, 'metric');
    expect([systolic[0].y, diastolic[0].y]).toEqual([120, 80]);
    expect(systolic[0].tooltip).toBe('03/14/2026 9:12 AM · 120/80 mm Hg');
    expect(diastolic[0].tooltip).toBe(systolic[0].tooltip);
  });
});

describe('yAxisBounds', () => {
  const bounds = (
    key: FlowsheetMeasureKey,
    values: number[],
    unitSystem: 'metric' | 'imperial' = 'metric'
  ): unknown => {
    const definition = chart(key);
    return yAxisBounds(
      definition.range,
      unitSystem === 'imperial' && definition.imperial ? definition.imperial : definition.metric,
      values
    );
  };

  it('SpO₂ runs 85 to 100 with ticks every 5, widened by whole ticks for a lower value', () => {
    expect(bounds(VitalFieldNames.VitalOxygenSaturation, [97, 99])).toEqual({ min: 85, max: 100, interval: 5 });
    expect(bounds(VitalFieldNames.VitalOxygenSaturation, [82, 99])).toEqual({ min: 80, max: 100, interval: 5 });
  });

  it('temperature runs 35 to 40 °C, 95 to 104 °F, widened to fit a value outside', () => {
    expect(bounds(VitalFieldNames.VitalTemperature, [36.6, 37])).toEqual({ min: 35, max: 40, interval: 1 });
    expect(bounds(VitalFieldNames.VitalTemperature, [97.9, 98.6], 'imperial')).toEqual({
      min: 95,
      max: 104,
      interval: 1,
    });
    expect(bounds(VitalFieldNames.VitalTemperature, [36.6, 40.6])).toEqual({ min: 35, max: 41, interval: 1 });
  });

  it('heart rate spans at least 40 and respiratory rate at least 20, around the values', () => {
    expect(bounds(VitalFieldNames.VitalHeartbeat, [76])).toEqual({ min: 50, max: 100, interval: 10 });
    expect(bounds(VitalFieldNames.VitalRespirationRate, [14, 16])).toEqual({ min: 5, max: 25, interval: 5 });
    expect(bounds(VitalFieldNames.VitalHeartbeat, [72, 130])).toEqual({ min: 60, max: 140, interval: 20 });
  });

  it('weight, BMI and blood pressure run 10% either side of the median, widened to fit every value', () => {
    expect(bounds(VitalFieldNames.VitalWeight, [76, 80, 78])).toEqual({ min: 70, max: 90, interval: 5 });
    expect(bounds(VitalFieldNames.VitalBMI, [24, 24.4, 24.7, 25.2])).toEqual({ min: 22, max: 28, interval: 1 });
    expect(bounds(VitalFieldNames.VitalBloodPressure, [120, 80, 118, 76])).toEqual({ min: 70, max: 130, interval: 10 });
  });
});

describe('timeTickLabel', () => {
  const tick = (iso: string): string => timeTickLabel(new Date(iso).getTime());

  it('shows the date, and the year on a new year', () => {
    expect(tick('2026-03-14T00:00:00')).toBe('03/14');
    expect(tick('2026-01-01T00:00:00')).toBe('2026');
  });

  it('shows 12-hour times within a day', () => {
    expect(tick('2026-03-14T16:00:00')).toBe('4 PM');
    expect(tick('2026-03-14T00:30:00')).toBe('12:30 AM');
  });
});
