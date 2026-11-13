import { FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { FlowsheetChart } from './registry';

/** The AAP 2022 bilirubin figures run from birth to 14 days: hours of life 0–336. */
export const HOURS_OF_LIFE_MAX = 336;

/** The hours of life at a reading's time, when the flowsheet carries them (the time of birth is recorded). */
export const hoursOfLifeAt = (visit: FlowsheetVisit, time: string): number | undefined => {
  const hours = visit.values.hoursOfLife?.readings.find((reading) => reading.time === time)?.value;
  return typeof hours === 'number' ? hours : undefined;
};

/** A chart plots against hours of life when it asks to and any visit shown carries them; else against time. */
export const usesHoursAxis = (chart: FlowsheetChart, visits: FlowsheetVisit[]): boolean =>
  !!chart.hoursOfLife && visits.some((visit) => visit.values.hoursOfLife !== undefined);

/**
 * [x, y] of a line's latest reading in a visit: x is the reading's hours of life (only within 0–336 h) on the
 * hours axis, else the visit start; undefined when there is nothing numeric to plot.
 */
export const chartPoint = (visit: FlowsheetVisit, key: string, hoursAxis: boolean): [number, number] | undefined => {
  const reading = visit.values[key];
  if (!reading || typeof reading.value !== 'number') return undefined;
  if (!hoursAxis) return [Date.parse(visit.start), reading.value];
  const hours = hoursOfLifeAt(visit, reading.time);
  return hours !== undefined && hours >= 0 && hours <= HOURS_OF_LIFE_MAX ? [hours, reading.value] : undefined;
};

/**
 * The y-axis [min, max] for values spanning dataMin–dataMax, so a small change does not fill the chart: the chart's
 * yRange widened to fit the values, else at least minSpan (or ±10% of the middle value) around them, never below 0
 * for positive values. Bounds are rounded out to a round step, a step further where a value would sit on the frame.
 */
export const yAxisBounds = (chart: FlowsheetChart, dataMin: number, dataMax: number): [number, number] => {
  if (chart.yRange) return [Math.min(chart.yRange[0], dataMin), Math.max(chart.yRange[1], dataMax)];
  const middle = (dataMin + dataMax) / 2;
  const span = Math.max(dataMax - dataMin, chart.minSpan ?? Math.abs(middle) * 0.2);
  if (span === 0) return [dataMin, dataMax];
  const step = 10 ** Math.floor(Math.log10(span)) / 2;
  // Trim floating-point noise (0.8800000000000001) before rounding out, and from the result.
  const exact = (n: number): number => Number(n.toPrecision(12));
  let low = exact(Math.floor(exact((middle - span / 2) / step)) * step);
  let high = exact(Math.ceil(exact((middle + span / 2) / step)) * step);
  if (low === dataMin) low = exact(low - step);
  if (high === dataMax) high = exact(high + step);
  return [dataMin >= 0 ? Math.max(0, low) : low, high];
};
