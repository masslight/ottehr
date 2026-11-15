import { FlowsheetValue, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, it } from 'vitest';
import {
  chartPoint,
  HOURS_OF_LIFE_MAX,
  hoursOfLifeAt,
  usesHoursAxis,
  yAxisBounds,
} from '../../src/features/flowsheets/chartPoints';
import { FLOWSHEETS } from '../../src/features/flowsheets/registry';

const reading = (value: number, time: string, unit?: string): FlowsheetValue => ({
  time,
  value,
  unit,
  readings: [{ time, value, unit }],
});

const visit = (values: Record<string, FlowsheetValue>): FlowsheetVisit => ({
  start: '2026-07-13T14:00:00.000Z',
  isFollowUp: false,
  reason: '',
  primaryDiagnosis: '',
  attending: '',
  values,
});

const bilirubin = FLOWSHEETS.find((f) => f.id === 'newbornBilirubin')!.charts[0];

describe('newborn bilirubin chart x-axis: hours of life when the time of birth is recorded', () => {
  const t1 = '2026-07-13T14:20:00.000Z';
  const t2 = '2026-07-13T18:00:00.000Z';
  const withHours = visit({
    transcutaneousBilirubin: reading(13.1, t1, 'mg/dL'),
    newbornTotalBilirubin: reading(13.8, t2, 'mg/dL'),
    hoursOfLife: {
      ...reading(82, t2),
      readings: [
        { time: t1, value: 78.3 },
        { time: t2, value: 82 },
      ],
    },
  });
  const withoutHours = visit({ newbornTotalBilirubin: reading(13.8, t2, 'mg/dL') });

  it('the bilirubin chart asks for the hours axis and uses it only when a visit carries hours of life', () => {
    expect(bilirubin.hoursOfLife).toBe(true);
    expect(usesHoursAxis(bilirubin, [withHours, withoutHours])).toBe(true);
    expect(usesHoursAxis(bilirubin, [withoutHours])).toBe(false);
    expect(usesHoursAxis(FLOWSHEETS.find((f) => f.id === 'vitals')!.charts[0], [withHours])).toBe(false);
  });

  it('each reading plots at its own hours of life; on the time axis at the visit start', () => {
    expect(hoursOfLifeAt(withHours, t1)).toBe(78.3);
    expect(chartPoint(withHours, 'transcutaneousBilirubin', true, 'mg/dL')).toEqual([78.3, 13.1]);
    expect(chartPoint(withHours, 'newbornTotalBilirubin', true, 'mg/dL')).toEqual([82, 13.8]);
    expect(chartPoint(withHours, 'newbornTotalBilirubin', false, 'mg/dL')).toEqual([Date.parse(withHours.start), 13.8]);
    expect(chartPoint(withHours, 'newbornDirectBilirubin', true, 'mg/dL')).toBeUndefined();
  });

  it('only readings within 0–336 h plot on the hours axis; a visit without hours has no point there', () => {
    expect(HOURS_OF_LIFE_MAX).toBe(336);
    const late = visit({
      newbornTotalBilirubin: reading(9, t2, 'mg/dL'),
      hoursOfLife: reading(400, t2),
    });
    expect(chartPoint(late, 'newbornTotalBilirubin', true, 'mg/dL')).toBeUndefined();
    expect(chartPoint(withoutHours, 'newbornTotalBilirubin', true, 'mg/dL')).toBeUndefined();
    expect(chartPoint(withoutHours, 'newbornTotalBilirubin', false, 'mg/dL')).toEqual([
      Date.parse(withoutHours.start),
      13.8,
    ]);
  });
});

describe('trend charts plot only readings in the chart unit, converting the standard pairs', () => {
  const t = '2026-07-13T18:00:00.000Z';
  const lab = (value: number, unit: string): FlowsheetValue => ({
    time: t,
    value,
    unit,
    readings: [{ time: t, value, unit }],
  });
  const at = (key: string, value: FlowsheetValue): FlowsheetVisit => visit({ [key]: value });
  const start = Date.parse(visit({}).start);

  it('a reading in the chart unit plots as is, whatever its spelling; a vital (no unit) plots as is', () => {
    expect(chartPoint(at('freeT4', lab(1.2, 'ng/dL')), 'freeT4', false, 'ng/dL')).toEqual([start, 1.2]);
    expect(chartPoint(at('tsh', lab(2.1, 'mIU/L')), 'tsh', false, 'mIU/L')).toEqual([start, 2.1]);
    expect(chartPoint(at('tsh', lab(2.1, 'uIU/mL')), 'tsh', false, 'mIU/L')).toEqual([start, 2.1]);
    expect(chartPoint(at('tsh', lab(2.1, 'µIU/mL')), 'tsh', false, 'mIU/L')).toEqual([start, 2.1]);
    expect(chartPoint(at('egfr', lab(95, 'mL/min/{1.73_m2}')), 'egfr', false, 'mL/min/1.73m²')).toEqual([start, 95]);
    // UCUM writes international units in brackets.
    expect(chartPoint(at('tsh', lab(2.1, 'm[IU]/L')), 'tsh', false, 'mIU/L')).toEqual([start, 2.1]);
    expect(chartPoint(at('tsh', lab(2.1, 'u[IU]/mL')), 'tsh', false, 'mIU/L')).toEqual([start, 2.1]);
    expect(chartPoint(at('heartRate', reading(80, t)), 'heartRate', false, '/min')).toEqual([start, 80]);
  });

  it('Free T4 in pmol/L and bilirubin in µmol/L convert to the chart unit', () => {
    expect(chartPoint(at('freeT4', lab(15, 'pmol/L')), 'freeT4', false, 'ng/dL')).toEqual([start, 1.17]);
    expect(
      chartPoint(at('newbornTotalBilirubin', lab(200, 'umol/L')), 'newbornTotalBilirubin', false, 'mg/dL')
    ).toEqual([start, 11.7]);
    expect(
      chartPoint(at('transcutaneousBilirubin', lab(171, 'µmol/L')), 'transcutaneousBilirubin', false, 'mg/dL')
    ).toEqual([start, 10]);
  });

  it('creatinine in µmol/L, hemoglobin in g/L and LDL in mmol/L convert to the chart unit', () => {
    expect(chartPoint(at('creatinine', lab(70, 'umol/L')), 'creatinine', false, 'mg/dL')).toEqual([start, 0.79]);
    expect(chartPoint(at('creatinine', lab(88.4, 'µmol/L')), 'creatinine', false, 'mg/dL')).toEqual([start, 1]);
    expect(chartPoint(at('hemoglobin', lab(120, 'g/L')), 'hemoglobin', false, 'g/dL')).toEqual([start, 12]);
    expect(chartPoint(at('ldlCholesterol', lab(2.6, 'mmol/L')), 'ldlCholesterol', false, 'mg/dL')).toEqual([
      start,
      100.54,
    ]);
  });

  it('a lab reading with no unit does not plot (it stays in the grid); a vital never has one and plots', () => {
    const noUnit = (value: number): FlowsheetValue => ({ time: t, value, readings: [{ time: t, value }] });
    expect(chartPoint(at('creatinine', noUnit(88)), 'creatinine', false, 'mg/dL')).toBeUndefined();
    expect(chartPoint(at('tsh', noUnit(2.1)), 'tsh', false, 'mIU/L')).toBeUndefined();
    expect(chartPoint(at('weight', noUnit(61.5)), 'weight', false, 'kg')).toEqual([start, 61.5]);
    expect(chartPoint(at('systolic', noUnit(120)), 'systolic', false, 'mm Hg')).toEqual([start, 120]);
  });

  it('a reading in any other unit does not plot (it stays in the grid)', () => {
    expect(chartPoint(at('freeT4', lab(1.2, 'pg/mL')), 'freeT4', false, 'ng/dL')).toBeUndefined();
    expect(chartPoint(at('creatinine', lab(70, 'mmol/L')), 'creatinine', false, 'mg/dL')).toBeUndefined();
    expect(chartPoint(at('hemoglobin', lab(7.4, 'mmol/L')), 'hemoglobin', false, 'g/dL')).toBeUndefined();
    expect(
      chartPoint(at('urineAlbuminCreatinineRatio', lab(3.4, 'mg/mmol')), 'urineAlbuminCreatinineRatio', false, 'mg/g')
    ).toBeUndefined();
  });

  it('the Vitals BMI and Lab results urine albumin/creatinine charts: mg/g as UCUM, µg/mg or mcg/mg writes it plots', () => {
    const charts = FLOWSHEETS.flatMap((f) => f.charts.map((c) => [f.id, c.title, c.unit]));
    expect(charts).toContainEqual(['vitals', 'BMI', 'kg/m²']);
    expect(charts).toContainEqual(['labResults', 'Urine albumin/creatinine ratio', 'mg/g']);
    expect(chartPoint(at('bmi', reading(27.4, t)), 'bmi', false, 'kg/m²')).toEqual([start, 27.4]);
    [
      'mg/g',
      'mg/g{creat}',
      'mg/g creat',
      'mg/g creatinine',
      'ug/mg',
      'µg/mg{creat}',
      'mcg/mg creat',
      'mcg/mg',
      'MCG/MG CREAT',
      'mcg/mg creatinine',
    ].forEach((unit) =>
      expect(
        chartPoint(at('urineAlbuminCreatinineRatio', lab(42, unit)), 'urineAlbuminCreatinineRatio', false, 'mg/g')
      ).toEqual([start, 42])
    );
  });
});

describe('trend chart y-axis: a small change does not fill the chart', () => {
  const chart = (title: string): (typeof FLOWSHEETS)[number]['charts'][number] =>
    FLOWSHEETS.flatMap((f) => f.charts).find((c) => c.title === title)!;

  it('SpO₂ shows at least 85–100, temperature 35–40 °C, widened to fit an outside value', () => {
    expect(yAxisBounds(chart('SpO₂'), 98, 99)).toEqual([85, 100]);
    expect(yAxisBounds(chart('SpO₂'), 82, 99)).toEqual([82, 100]);
    expect(yAxisBounds(chart('Temperature'), 36.75, 37)).toEqual([35, 40]);
    expect(yAxisBounds(chart('Temperature'), 36.8, 40.6)).toEqual([35, 40.6]);
  });

  it('heart rate is at least 40 /min tall, centred on the values', () => {
    expect(yAxisBounds(chart('Heart rate'), 98, 102)).toEqual([80, 120]);
  });

  it('Vitals charts respiratory rate after heart rate, at least 20 /min tall, centred on the values', () => {
    const vitals = FLOWSHEETS.find((f) => f.id === 'vitals')!.charts;
    expect(vitals.map((c) => `${c.title} (${c.unit})`).slice(0, 3)).toEqual([
      'Heart rate (/min)',
      'Respiratory rate (/min)',
      'SpO₂ (%)',
    ]);
    expect(chart('Respiratory rate').lines).toEqual([{ name: 'Respiratory rate', key: 'respirationRate' }]);
    expect(yAxisBounds(chart('Respiratory rate'), 16, 18)).toEqual([5, 30]);
    expect(yAxisBounds(chart('Respiratory rate'), 24, 60)).toEqual([20, 65]);
  });

  it('labs and weight span at least ±10% of the middle value; bounds are round numbers', () => {
    expect(yAxisBounds(chart('Creatinine'), 0.78, 0.82)).toEqual([0.7, 0.9]);
    expect(yAxisBounds(chart('Weight'), 3.1, 3.3)).toEqual([2.85, 3.55]);
    expect(yAxisBounds(chart('Weight'), 3.13, 9.71)).toEqual([3, 10]);
  });

  it('values wider than the minimum get round bounds a step past any value on the frame', () => {
    expect(yAxisBounds(chart('Blood pressure'), 43, 127)).toEqual([40, 130]);
    expect(yAxisBounds(chart('Creatinine'), 0.5, 1.5)).toEqual([0, 2]);
  });
});
