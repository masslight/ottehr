import { LmsRow, valueAtZ, zForPercentile } from 'utils/lib/helpers/vitals/growth-lms';
import { GrowthChartPoint } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, it } from 'vitest';
import {
  buildGrowthChartOption,
  defaultGrowthSet,
  formatGrowthValue,
  formatGrowthValueBothUnits,
  GROWTH_CHART_VIEWS,
  GROWTH_SETS,
  growthTooltip,
} from '../../src/features/flowsheets/growthChartOption';

// A small WHO-like weight-for-age table (months 0-24, L = 0 so the curves are M e^(S z)).
const table: LmsRow[] = Array.from({ length: 25 }, (_, month) => [month, 0, 3.3 + month * 0.37, 0.12]);

const point = (over: Partial<GrowthChartPoint>): GrowthChartPoint => ({
  chart: 'who-wfa',
  encounterId: 'e1',
  time: '2026-07-10T14:05:00.000Z',
  age: '6 mo',
  x: 6,
  y: 5.5,
  z: 0.1,
  percentile: '54th',
  ...over,
});

type Series = Record<string, any>;
const seriesOf = (option: Record<string, unknown>): Series[] => option.series as Series[];

describe('growth chart option (the cards ported from the OTR-3741 report)', () => {
  it('opens on the set matching the age: WHO under 24 months, CDC from 24 months or without an age', () => {
    expect(defaultGrowthSet(5.9)).toBe('who');
    expect(defaultGrowthSet(23.99)).toBe('who');
    expect(defaultGrowthSet(24)).toBe('cdc');
    expect(defaultGrowthSet(230)).toBe('cdc');
    expect(defaultGrowthSet(undefined)).toBe('cdc');
  });

  it('has the report percentile sets and chart cards, plus the head circumference card', () => {
    expect(GROWTH_SETS.who.percentiles).toEqual([2, 5, 10, 25, 50, 75, 90, 95, 98]);
    expect(GROWTH_SETS.cdc.percentiles).toEqual([3, 5, 10, 25, 50, 75, 90, 95, 97]);
    expect(GROWTH_SETS.who.charts.map((id) => GROWTH_CHART_VIEWS[id].title)).toEqual([
      'Weight-for-age',
      'Length-for-age',
      'Weight-for-length',
      'Head circumference-for-age',
    ]);
    expect(GROWTH_SETS.cdc.charts.map((id) => GROWTH_CHART_VIEWS[id].title)).toEqual([
      'Weight-for-age',
      'Stature-for-age',
      'BMI-for-age',
    ]);
    // Axes: months under 2 (0 reads "Birth", then 2, 4 …), "2 y, 3 y … 20 y" from 2, length in cm for weight-for-length.
    expect(GROWTH_CHART_VIEWS['who-wfa'].xAxis).toMatchObject({ min: 0, max: 24, name: 'Age (months)' });
    expect(GROWTH_CHART_VIEWS['who-wfa'].xAxis.formatter?.(0)).toBe('Birth');
    expect(GROWTH_CHART_VIEWS['who-wfa'].xAxis.formatter?.(12)).toBe('12');
    expect(GROWTH_CHART_VIEWS['cdc-sfa'].xAxis).toMatchObject({ min: 24, max: 240, name: 'Age (years)' });
    expect([24, 36, 120, 240].map((months) => GROWTH_CHART_VIEWS['cdc-sfa'].xAxis.formatter?.(months))).toEqual([
      '2 y',
      '3 y',
      '10 y',
      '20 y',
    ]);
    expect(GROWTH_CHART_VIEWS['who-wfl'].xAxis).toMatchObject({ min: 45, max: 110, name: 'Length (cm)' });
  });

  it('draws one labelled curve per percentile from the LMS rows, the 50th emphasised, in the sex tint', () => {
    const { option } = buildGrowthChartOption('who-wfa', 'female', table, []);
    const curves = seriesOf(option).slice(0, 9);
    expect(curves.map((s) => s.endLabel.formatter)).toEqual(['2', '5', '10', '25', '50', '75', '90', '95', '98']);
    const median = curves[4];
    expect(median.lineStyle.width).toBeGreaterThan(curves[0].lineStyle.width);
    expect(median.endLabel.fontWeight).toBe(700);
    expect(median.data).toHaveLength(25);
    // The 50th curve is M; the 98th is M e^(S z98).
    expect(median.data[6][1]).toBeCloseTo(table[6][2], 8);
    expect(curves[8].data[6][1]).toBeCloseTo(valueAtZ({ L: 0, M: table[6][2], S: 0.12 }, zForPercentile(98)), 8);
    expect(curves[0].tooltip.show).toBe(false);
    expect(curves[0].lineStyle.color).toBe('#c2185b'); // pink for girls
    expect((option.grid as Series).backgroundColor).toBe('#fdf6f9');
    const boys = buildGrowthChartOption('who-wfa', 'male', table, []);
    expect(seriesOf(boys.option)[0].lineStyle.color).toBe('#1e6fd0');
    expect((boys.option.grid as Series).backgroundColor).toBe('#f5f9fe');
    // The y axis spans the outer curves on a round step.
    const yAxis = (option.yAxis as Series[])[0];
    expect(yAxis.min).toBeLessThanOrEqual(curves[0].data[0][1]);
    expect(yAxis.max).toBeGreaterThanOrEqual(curves[8].data[24][1]);
    expect(yAxis.name).toBe('Weight (kg)');
  });

  it('joins the patient points by a line, this visit larger and outlined in EHR blue, and locates each row', () => {
    const earlier = point({ encounterId: 'e0', time: '2026-04-10T14:05:00.000Z', age: '3 mo', x: 3, y: 4.6 });
    const current = point({ encounterId: 'e1' });
    const { option, locate } = buildGrowthChartOption('who-wfa', 'female', table, [earlier, current], 'e1');
    const patient = seriesOf(option)[9];
    expect(patient.type).toBe('line');
    expect(patient.data.map((d: Series) => d.value)).toEqual([
      [3, 4.6],
      [6, 5.5],
    ]);
    expect(patient.data[0]).toMatchObject({ symbolSize: 7, itemStyle: { color: '#0F347C' } });
    expect(patient.data[1]).toMatchObject({ symbolSize: 11, itemStyle: { color: '#fff', borderColor: '#2169F5' } });
    expect(patient.data[1].point).toBe(current);
    expect(locate.get(earlier)).toEqual({ seriesIndex: 9, dataIndex: 0 });
    expect(locate.get(current)).toEqual({ seriesIndex: 9, dataIndex: 1 });
  });

  it('keeps implausible points off the line: a red cross in range, a red arrow at the edge when off the chart', () => {
    const inRange = point({ y: 3.9, z: -3, implausible: true, percentile: undefined, note: 'implausible (z -3.1)' });
    const wayOff = point({
      time: '2026-08-10T14:05:00.000Z',
      x: 7,
      y: 30,
      z: 9,
      implausible: true,
      percentile: undefined,
    });
    const low = point({
      time: '2026-09-10T14:05:00.000Z',
      x: 8,
      y: 0.5,
      z: -9,
      implausible: true,
      percentile: undefined,
    });
    const noZ = point({
      time: '2026-10-10T14:05:00.000Z',
      x: 9,
      z: undefined,
      percentile: undefined,
      note: 'outside the table',
    });
    const { option, locate } = buildGrowthChartOption('who-wfa', 'female', table, [inRange, wayOff, low, noZ]);
    const patient = seriesOf(option)[9];
    const flagged = seriesOf(option)[10];
    expect(patient.data).toHaveLength(0);
    expect(flagged.type).toBe('scatter');
    expect(flagged.itemStyle.color).toBe('#d32f2f');
    expect(flagged.data).toHaveLength(3); // a point without a z is listed, not drawn
    expect(flagged.data[0]).toMatchObject({ value: [6, 3.9], symbolRotate: 0 });
    expect(flagged.data[0].symbol).toMatch(/^path:\/\//);
    const yAxis = (option.yAxis as Series[])[0];
    expect(flagged.data[1]).toMatchObject({ value: [7, yAxis.max], symbol: 'arrow', symbolRotate: 0 });
    expect(flagged.data[2]).toMatchObject({ value: [8, yAxis.min], symbol: 'arrow', symbolRotate: 180 });
    expect(locate.get(wayOff)).toEqual({ seriesIndex: 10, dataIndex: 1 });
    expect(locate.get(noZ)).toBeUndefined();
  });

  it('tooltips are plain text (date · age · value · percentile, or the ⚠ note) and never HTML', () => {
    const view = GROWTH_CHART_VIEWS['who-wfa'];
    const tooltip = (option.tooltip as Series).formatter as (params: Series) => string;
    expect((option.tooltip as Series).renderMode).toBe('richText');
    const shown = point({ y: 5.456, percentile: '54th' });
    expect(tooltip({ data: { point: shown } })).toBe(
      `${expectedDate(shown.time)} · 6 mo · 5.46 kg ≈ 12.03 lbs\n54th percentile`
    );
    const bad = point({
      percentile: undefined,
      implausible: true,
      note: 'implausible (z 7.9) — not plotted on the line',
    });
    expect(growthTooltip(bad, view)).toBe(
      `${expectedDate(bad.time)} · 6 mo · 5.50 kg ≈ 12.13 lbs\n⚠ implausible (z 7.9) — not plotted on the line`
    );
    expect(tooltip({ data: {} })).toBe('');
    // Weight-for-length shows the weight at the length; the table uses "@", the tooltip "at".
    const wfl = point({ chart: 'who-wfl', x: 65.04, y: 7.3 });
    expect(formatGrowthValue(wfl, GROWTH_CHART_VIEWS['who-wfl'])).toBe('7.30 kg @ 65.0 cm');
    expect(growthTooltip(wfl, GROWTH_CHART_VIEWS['who-wfl'])).toContain('7.30 kg ≈ 16.09 lbs at 65.0 cm');
  });

  it('shows both units: kg left / lbs right on weight charts, cm / in on length and head charts, BMI alone', () => {
    const weight = option.yAxis as Series[];
    expect(weight.map((axis) => axis.name)).toEqual(['Weight (kg)', 'Weight (lbs)']);
    expect(weight[1]).toMatchObject({ position: 'right', min: weight[0].min * 2.20462, max: weight[0].max * 2.20462 });
    expect(weight[1].interval).toBeCloseTo(weight[0].interval * 2.20462, 10);
    expect(weight[1].axisLabel.formatter(12.0345)).toBe('12.0');
    const stature = buildGrowthChartOption('cdc-sfa', 'male', table, []).option.yAxis as Series[];
    expect(stature.map((axis) => axis.name)).toEqual(['Stature (cm)', 'Stature (in)']);
    expect(stature[1].max).toBeCloseTo(stature[0].max * 0.393701, 2);
    expect(GROWTH_CHART_VIEWS['who-hcfa'].imperial?.yLabel).toBe('Head circumference (in)');
    expect((buildGrowthChartOption('cdc-bmi', 'male', table, []).option.yAxis as Series[]).length).toBe(1);
    const length = point({ chart: 'who-lfa', y: 65.04 });
    expect(formatGrowthValueBothUnits(length, GROWTH_CHART_VIEWS['who-lfa'])).toBe('65.0 cm ≈ 25.61 in');
    expect(formatGrowthValueBothUnits(point({ chart: 'cdc-bmi', y: 16.84 }), GROWTH_CHART_VIEWS['cdc-bmi'])).toBe(
      '16.8 kg/m²'
    );
  });
});

const { option } = buildGrowthChartOption('who-wfa', 'female', table, []);
// MM/dd/yyyy in the test runner's zone.
const expectedDate = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
};
