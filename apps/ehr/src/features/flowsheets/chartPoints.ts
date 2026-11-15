import { kgToLbs } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { FlowsheetChart, FLOWSHEETS } from './registry';

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
 * "µIU/mL", "uIU/mL", UCUM's "u[IU]/mL" and "mL/min/{1.73_m2}" read alike: lower case, u for µ, no spaces,
 * brackets, braces or underscores.
 */
const normalUnit = (unit: string): string =>
  unit
    .toLowerCase()
    .replace(/[µμ]/g, 'u')
    .replace(/[\s{}[\]_]/g, '')
    .replace('²', '2');

/** Per line key, the factor from a lab unit (normalised) to the chart's unit: the standard conversions only. */
const TO_CHART_UNIT: Record<string, Record<string, number>> = {
  tsh: { 'uiu/ml': 1 },
  freeT4: { 'pmol/l': 1 / 12.87 },
  newbornTotalBilirubin: { 'umol/l': 1 / 17.1 },
  transcutaneousBilirubin: { 'umol/l': 1 / 17.1 },
};

/**
 * A vital (a Vitals flowsheet measure) is saved in its row's metric unit and carries none (a weight charted in lbs is
 * converted); a lab result carries its own.
 */
const VITAL_KEYS = new Set(FLOWSHEETS.find((f) => f.id === 'vitals')?.rows.flatMap((row) => row.keys));

/** The reading's value in the chart's unit; undefined for a unit the chart can't plot, or a lab result with none. */
const inChartUnit = (key: string, value: number, unit: string | undefined, chartUnit: string): number | undefined => {
  if (!unit) return VITAL_KEYS.has(key) ? (chartUnit === 'lbs' ? kgToLbs(value) : value) : undefined;
  if (normalUnit(unit) === normalUnit(chartUnit)) return value;
  const factor = TO_CHART_UNIT[key]?.[normalUnit(unit)];
  return factor === undefined ? undefined : Number((value * factor).toFixed(2));
};

/**
 * [x, y] of a line's latest reading in a visit, in the chart's unit: x is the reading's hours of life (only within
 * 0–336 h) on the hours axis, else the visit start; undefined when there is nothing numeric to plot in that unit.
 */
export const chartPoint = (
  visit: FlowsheetVisit,
  key: string,
  hoursAxis: boolean,
  chartUnit: string
): [number, number] | undefined => {
  const reading = visit.values[key];
  if (!reading || typeof reading.value !== 'number') return undefined;
  const value = inChartUnit(key, reading.value, reading.unit, chartUnit);
  if (value === undefined) return undefined;
  if (!hoursAxis) return [Date.parse(visit.start), value];
  const hours = hoursOfLifeAt(visit, reading.time);
  return hours !== undefined && hours >= 0 && hours <= HOURS_OF_LIFE_MAX ? [hours, value] : undefined;
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
