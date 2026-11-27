import { DateTime } from 'luxon';
import { VitalAlertCriticality } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { VitalsHeaderUnitSystem } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { describeReading, inUnit, TIME_FORMAT, unitOf } from './format';
import { FlowsheetChart, FlowsheetChartRange, FlowsheetUnit } from './registry';

export interface ChartPoint {
  visitIndex: number;
  x: number;
  y: number;
  flag?: VitalAlertCriticality;
  tooltip: string;
}

export const chartPointsOf = (
  chart: FlowsheetChart,
  visits: FlowsheetVisit[],
  unitSystem: VitalsHeaderUnitSystem
): ChartPoint[][] => {
  const unit = unitOf(chart, unitSystem);
  const latest = visits
    .flatMap((visit, visitIndex) => {
      const reading = visit.values[chart.key]?.at(-1);
      return reading ? [{ visitIndex, reading }] : [];
    })
    .sort((a, b) => Date.parse(a.reading.time) - Date.parse(b.reading.time));
  return chart.lines.map((_, lineIndex) =>
    latest.map(({ visitIndex, reading }) => ({
      visitIndex,
      x: Date.parse(reading.time),
      y: inUnit(reading.values[lineIndex], unit),
      flag: reading.flag,
      tooltip: describeReading(chart, reading, unitSystem, ' · '),
    }))
  );
};

const exact = (value: number): number => Number(value.toPrecision(12));

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export interface AxisBounds {
  min: number;
  max: number;
  interval?: number;
}

const TARGET_TICKS = 5;

const niceStep = (span: number): number => {
  const raw = span / TARGET_TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
};

const roundOut = (low: number, high: number, dataMin: number, dataMax: number): AxisBounds => {
  if (high <= low) return { min: low, max: high };
  const interval = niceStep(high - low);
  let min = exact(Math.floor(exact(low / interval)) * interval);
  let max = exact(Math.ceil(exact(high / interval)) * interval);
  if (min === dataMin) min = exact(min - interval);
  if (max === dataMax) max = exact(max + interval);
  return { min: dataMin >= 0 ? Math.max(0, min) : min, max, interval };
};

export const yAxisBounds = (range: FlowsheetChartRange, unit: FlowsheetUnit, values: number[]): AxisBounds => {
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  if (range.kind === 'fixed') {
    const min = Math.min(inUnit(range.min, unit), dataMin);
    const max = Math.max(inUnit(range.max, unit), dataMax);
    if (!range.step) return { min: exact(min), max: exact(max) };
    return {
      min: Math.floor(min / range.step) * range.step,
      max: Math.ceil(max / range.step) * range.step,
      interval: range.step,
    };
  }
  if (range.kind === 'span') {
    const middle = (dataMin + dataMax) / 2;
    const span = Math.max(range.span, dataMax - dataMin);
    return roundOut(middle - span / 2, middle + span / 2, dataMin, dataMax);
  }
  const middle = median(values);
  return roundOut(
    Math.min(middle * (1 - range.fraction), dataMin),
    Math.max(middle * (1 + range.fraction), dataMax),
    dataMin,
    dataMax
  );
};

export const timeTickLabel = (value: number): string => {
  const tick = DateTime.fromMillis(value);
  if (tick.hour === 0 && tick.minute === 0) return tick.toFormat(tick.month === 1 && tick.day === 1 ? 'yyyy' : 'MM/dd');
  return tick.toFormat(tick.minute === 0 ? 'h a' : TIME_FORMAT);
};
