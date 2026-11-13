import { FlowsheetValue, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, it } from 'vitest';
import {
  BiliToolReading,
  biliToolReadings,
  biliToolUnits,
  buildBiliToolUrl,
  canOpenBiliTool,
  defaultBiliToolReading,
  formatBiliToolReading,
} from '../../src/features/flowsheets/biliTool';

const visit = (values: Record<string, FlowsheetValue>, start = '2025-05-20T14:00:00.000Z'): FlowsheetVisit => ({
  start,
  isFollowUp: false,
  visitType: '',
  reason: '',
  primaryDiagnosis: '',
  attending: '',
  values,
});
const value = (readings: { time: string; value: number; unit?: string }[]): FlowsheetValue => ({
  ...readings[readings.length - 1],
  readings,
});
const at = (hours: number): string =>
  new Date(Date.parse('2025-05-17T00:00:00.000Z') + hours * 3_600_000).toISOString();

// Born 2025-05-17 00:00 (hours of life = hours since then). Visit 1: serum at 74 h, TcB at 74 h. Visit 2: serum
// 122 h + TcB 122 h, serum 146 h. Visit 3: serum 218 h, a direct bilirubin (never sent), a serum in a unit
// BiliTool does not take, and a result past 336 h.
const visits: FlowsheetVisit[] = [
  visit({
    newbornTotalBilirubin: value([
      { time: at(218), value: 9.2, unit: 'mg/dL' },
      { time: at(300), value: 8, unit: 'g/L' },
      { time: at(400), value: 6.1, unit: 'mg/dL' },
    ]),
    newbornDirectBilirubin: value([{ time: at(218), value: 0.4, unit: 'mg/dL' }]),
    hoursOfLife: value([
      { time: at(218), value: 218 },
      { time: at(300), value: 300 },
      { time: at(400), value: 400 },
    ]),
  }),
  visit({
    newbornTotalBilirubin: value([
      { time: at(122), value: 14.6, unit: 'mg/dL' },
      { time: at(146), value: 13.4, unit: 'mg/dL' },
    ]),
    transcutaneousBilirubin: value([{ time: at(122.4), value: 13.9, unit: 'mg/dL' }]),
    hoursOfLife: value([
      { time: at(122), value: 122 },
      { time: at(122.4), value: 122.4 },
      { time: at(146), value: 146 },
    ]),
  }),
  visit({
    newbornTotalBilirubin: value([{ time: at(74), value: 11.6, unit: 'mg/dL' }]),
    transcutaneousBilirubin: value([{ time: at(73.6), value: 11.2, unit: 'mg/dL' }]),
    hoursOfLife: value([
      { time: at(73.6), value: 73.6 },
      { time: at(74), value: 74 },
    ]),
  }),
];
const birthHistory = { timeOfBirth: '00:00', gestationalAgeWeeks: 38, gestationalAgeDays: 0 };

describe('Open in BiliTool', () => {
  const readings = biliToolReadings(visits);

  it('lists every blood and skin-meter reading within 1–336 h in mg/dL or µmol/L, newest first', () => {
    expect(readings.map(formatBiliToolReading)).toEqual([
      '9.2 mg/dL · blood · 218 h',
      '13.4 mg/dL · blood · 146 h',
      '13.9 mg/dL · skin meter (TcB) · 122 h',
      '14.6 mg/dL · blood · 122 h',
      '11.6 mg/dL · blood · 74 h',
      '11.2 mg/dL · skin meter (TcB) · 74 h',
    ]);
    expect(biliToolUnits('MG/DL')).toBe('US');
    expect(biliToolUnits('µmol/L')).toBe('SI');
    expect(biliToolUnits('umol/L')).toBe('SI');
    expect(biliToolUnits('g/L')).toBeUndefined();
  });

  it('starts on the newest blood result; nothing when there is none', () => {
    expect(defaultBiliToolReading(readings)?.value).toBe(9.2);
    expect(defaultBiliToolReading(readings.filter((r) => r.kind === 'tcb'))).toBeUndefined();
  });

  it('builds the results URL from numbers and enums only, with the trend of earlier readings of the same kind', () => {
    const url = new URL(
      buildBiliToolUrl({ reading: readings[0], readings, gestationalWeeks: 38, neuroRiskFactors: false })
    );
    expect(url.origin + url.pathname).toBe('https://emr.bilitool.org/results.php');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      ageHours: '74,122,146,218',
      totalBilirubin: '11.6,14.6,13.4,9.2',
      bilirubinUnits: 'US',
      gestationalWeeks: '38',
      neuroRiskFactors: 'No',
    });
    // A skin-meter reading trends only with earlier skin-meter readings; hours round to whole numbers.
    const tcb = new URL(
      buildBiliToolUrl({ reading: readings[2], readings, gestationalWeeks: 36, neuroRiskFactors: true })
    );
    expect(Object.fromEntries(tcb.searchParams)).toEqual({
      ageHours: '74,122',
      totalBilirubin: '11.2,13.9',
      bilirubinUnits: 'US',
      gestationalWeeks: '36',
      neuroRiskFactors: 'Yes',
    });
    expect(tcb.searchParams.get('ageHours')!.split(',').length).toBe(
      tcb.searchParams.get('totalBilirubin')!.split(',').length
    );
  });

  it('clamps gestational weeks to BiliTool 35–40 (40 = 40+), one decimal, SI units pass through', () => {
    const si: BiliToolReading = {
      kind: 'blood',
      value: 180.25,
      unit: 'µmol/L',
      units: 'SI',
      hours: 0.6,
      time: at(0.6),
    };
    const url = new URL(
      buildBiliToolUrl({ reading: si, readings: [si], gestationalWeeks: 41, neuroRiskFactors: false })
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      ageHours: '1',
      totalBilirubin: '180.3',
      bilirubinUnits: 'SI',
      gestationalWeeks: '40',
    });
  });

  it('offers the button only with a time of birth, 35+ weeks and a listable reading', () => {
    expect(canOpenBiliTool(birthHistory, readings)).toBe(true);
    expect(canOpenBiliTool({ ...birthHistory, timeOfBirth: undefined }, readings)).toBe(false);
    expect(canOpenBiliTool({ ...birthHistory, gestationalAgeWeeks: 34 }, readings)).toBe(false);
    expect(canOpenBiliTool({ ...birthHistory, gestationalAgeWeeks: undefined }, readings)).toBe(false);
    expect(canOpenBiliTool(undefined, readings)).toBe(false);
    expect(canOpenBiliTool(birthHistory, [])).toBe(false);
    // Without hours of life (no time of birth) nothing is listable.
    expect(
      biliToolReadings(visits.map((v) => visit({ newbornTotalBilirubin: v.values.newbornTotalBilirubin })))
    ).toEqual([]);
  });
});
