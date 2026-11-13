import { DateTime } from 'luxon';
import { DATE_FORMAT } from 'src/helpers/formatDateTime';
import { LmsRow, valueAtZ, zForPercentile } from 'utils/lib/helpers/vitals/growth-lms';
import { HeightMeasurement } from 'utils/lib/helpers/vitals/vitals-height.helper';
import { LBS_IN_KG } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { GrowthChartId, GrowthChartPoint, GrowthChartSet } from 'utils/lib/types/api/flowsheets.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';

// The growth chart cards' definitions and ECharts options, ported from the OTR-3741 growth-charts report. Pure, so
// the option can be unit-tested; the data (points, z-scores, LMS rows) comes from the get-flowsheet zambda.

interface GrowthSet {
  label: string;
  /** The title line's standard and age span. */
  title: string;
  percentiles: number[];
  /** The title line's percentile span, e.g. "3rd–97th". */
  percentileSpan: string;
  charts: GrowthChartId[];
}

export const GROWTH_SETS: Record<GrowthChartSet, GrowthSet> = {
  who: {
    label: 'Birth to 24 months (WHO)',
    title: 'WHO, birth–24 months',
    percentiles: [2, 5, 10, 25, 50, 75, 90, 95, 98],
    percentileSpan: '2nd–98th',
    charts: ['who-wfa', 'who-lfa', 'who-wfl', 'who-hcfa'],
  },
  cdc: {
    label: '2 to 20 years (CDC)',
    title: 'CDC, 2–20 years',
    percentiles: [3, 5, 10, 25, 50, 75, 90, 95, 97],
    percentileSpan: '3rd–97th',
    charts: ['cdc-wfa', 'cdc-sfa', 'cdc-bmi'],
  },
};

/** The chart set that opens: the one matching the age (WHO under 24 months), CDC without an age. */
export const defaultGrowthSet = (ageMonths?: number): GrowthChartSet =>
  ageMonths !== undefined && ageMonths < 24 ? 'who' : 'cdc';

interface XAxis {
  min: number;
  max: number;
  /** Major grid step (labelled); minor lines split it in minorSplit. */
  interval: number;
  minorSplit: number;
  name: string;
  formatter?: (value: number) => string;
}

const AGE_MONTHS: XAxis = {
  min: 0,
  max: 24,
  interval: 2,
  minorSplit: 2,
  name: 'Age (months)',
  formatter: (v) => (v === 0 ? 'Birth' : String(v)),
};
const AGE_YEARS: XAxis = {
  min: 24,
  max: 240,
  interval: 12,
  minorSplit: 2,
  name: 'Age (years)',
  formatter: (v) => String(v / 12),
};
const LENGTH_CM: XAxis = { min: 45, max: 110, interval: 5, minorSplit: 5, name: 'Length (cm)' };

/** The right-hand axis and hover text in imperial units; BMI has none. */
interface ImperialUnit {
  unit: string;
  yLabel: string;
  digits: number;
  convert: (metric: number) => number;
}

const LBS: ImperialUnit = { unit: 'lbs', yLabel: 'Weight (lbs)', digits: 2, convert: (kg) => kg * LBS_IN_KG };
const inches = (yLabel: string): ImperialUnit => ({
  unit: 'in',
  yLabel,
  digits: 2,
  convert: (cm) => HeightMeasurement.fromCm(cm).getInches(),
});

export interface GrowthChartView {
  title: string;
  yLabel: string;
  unit: string;
  digits: number;
  imperial?: ImperialUnit;
  xAxis: XAxis;
  /** Weight-for-length: x is the length, shown with the value. */
  xIsLength?: boolean;
  /** The measure has a chart in the other set too (the out-of-range note points there). */
  inOtherSet: boolean;
}

export const GROWTH_CHART_VIEWS: Record<GrowthChartId, GrowthChartView> = {
  'who-wfa': {
    title: 'Weight-for-age',
    yLabel: 'Weight (kg)',
    unit: 'kg',
    digits: 2,
    imperial: LBS,
    xAxis: AGE_MONTHS,
    inOtherSet: true,
  },
  'who-lfa': {
    title: 'Length-for-age',
    yLabel: 'Length (cm)',
    unit: 'cm',
    digits: 1,
    imperial: inches('Length (in)'),
    xAxis: AGE_MONTHS,
    inOtherSet: true,
  },
  'who-wfl': {
    title: 'Weight-for-length',
    yLabel: 'Weight (kg)',
    unit: 'kg',
    digits: 2,
    imperial: LBS,
    xAxis: LENGTH_CM,
    xIsLength: true,
    inOtherSet: true,
  },
  'who-hcfa': {
    title: 'Head circumference-for-age',
    yLabel: 'Head circumference (cm)',
    unit: 'cm',
    digits: 1,
    imperial: inches('Head circumference (in)'),
    xAxis: AGE_MONTHS,
    inOtherSet: false,
  },
  'cdc-wfa': {
    title: 'Weight-for-age',
    yLabel: 'Weight (kg)',
    unit: 'kg',
    digits: 2,
    imperial: LBS,
    xAxis: AGE_YEARS,
    inOtherSet: true,
  },
  'cdc-sfa': {
    title: 'Stature-for-age',
    yLabel: 'Stature (cm)',
    unit: 'cm',
    digits: 1,
    imperial: inches('Stature (in)'),
    xAxis: AGE_YEARS,
    inOtherSet: true,
  },
  'cdc-bmi': {
    title: 'BMI-for-age',
    yLabel: 'BMI (kg/m²)',
    unit: 'kg/m²',
    digits: 1,
    xAxis: AGE_YEARS,
    inOtherSet: true,
  },
};

// The report's colours: curves in a soft pink or blue tint, navy patient points, EHR blue for this visit.
const PALETTE = {
  female: { curve: '#c2185b', mid: '#880e4f', tint: '#fdf6f9', point: '#0F347C' },
  male: { curve: '#1e6fd0', mid: '#0d3c8c', tint: '#f5f9fe', point: '#0F347C' },
};
const EHR_BLUE = '#2169F5';
const RED = '#d32f2f';
const GRID_MAJOR = '#d9dee6';
const GRID_MINOR = '#eef1f5';
/** A filled ✕, for implausible points. */
const CROSS = 'path://M-4,-3L-3,-4L0,-1L3,-4L4,-3L1,0L4,3L3,4L0,1L-3,4L-4,3L-1,0Z';

const niceStep = (span: number, target: number): number => {
  const raw = span / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
};

// Exactly `digits` decimals (16.0, not 16), as the flowsheet table shows them.
const fixed = (value: number, digits: number): string => roundNumberToDecimalPlaces(value, digits).toFixed(digits);

/** "73.00 kg", "7.30 kg @ 65.0 cm" (the table) or "7.30 kg at 65.0 cm" (the tooltip). */
export const formatGrowthValue = (point: GrowthChartPoint, view: GrowthChartView, atLength = '@'): string =>
  `${fixed(point.y, view.digits)} ${view.unit}${view.xIsLength ? ` ${atLength} ${fixed(point.x, 1)} cm` : ''}`;

/** The hover text's value in both units: "5.80 kg ≈ 12.79 lbs", "7.30 kg ≈ 16.09 lbs at 65.0 cm"; BMI stays kg/m². */
export const formatGrowthValueBothUnits = (point: GrowthChartPoint, view: GrowthChartView): string => {
  const imperial = view.imperial
    ? ` ≈ ${fixed(view.imperial.convert(point.y), view.imperial.digits)} ${view.imperial.unit}`
    : '';
  return `${fixed(point.y, view.digits)} ${view.unit}${imperial}${view.xIsLength ? ` at ${fixed(point.x, 1)} cm` : ''}`;
};

export const formatGrowthDate = (iso: string): string => DateTime.fromISO(iso).toFormat(DATE_FORMAT);

/** The tooltip: "08/10/2026 · 19 y 4 mo · 73.00 kg ≈ 160.94 lbs" then "88th percentile" or the ⚠ note. Plain text, never HTML. */
export const growthTooltip = (point: GrowthChartPoint, view: GrowthChartView): string =>
  `${formatGrowthDate(point.time)} · ${point.age} · ${formatGrowthValueBothUnits(point, view)}\n${
    point.percentile ? `${point.percentile} percentile` : `⚠ ${point.note ?? ''}`
  }`;

export interface GrowthChartOption {
  option: Record<string, unknown>;
  /** Where each charted point is in the option, for showTip from its table row. */
  locate: Map<GrowthChartPoint, { seriesIndex: number; dataIndex: number }>;
}

/**
 * The ECharts option of one card: the set's percentile curves (labelled at the right end, the 50th emphasised),
 * the patient's points joined by a line (this visit's larger and outlined), implausible points as a red ✕ or, off
 * the chart, a red arrow at the edge.
 */
export const buildGrowthChartOption = (
  chartId: GrowthChartId,
  sex: 'male' | 'female',
  table: LmsRow[],
  points: GrowthChartPoint[],
  thisVisitEncounterId?: string
): GrowthChartOption => {
  const view = GROWTH_CHART_VIEWS[chartId];
  const set = GROWTH_SETS[chartId.startsWith('who') ? 'who' : 'cdc'];
  const pal = PALETTE[sex];
  const { xAxis } = view;

  const rows = table.filter((row) => row[0] >= xAxis.min && row[0] <= xAxis.max);
  const curves = set.percentiles.map((pct) => {
    const z = zForPercentile(pct);
    return { pct, data: rows.map((row) => [row[0], valueAtZ({ L: row[1], M: row[2], S: row[3] }, z)]) };
  });

  const shown = points.filter((point) => point.z !== undefined && point.x >= xAxis.min && point.x <= xAxis.max);
  const plotted = shown.filter((point) => !point.implausible).sort((a, b) => a.x - b.x);
  const flagged = shown.filter((point) => point.implausible);

  // The y range covers the outer curves and every plotted point, on a round step.
  const ys = [...curves[0].data, ...curves[curves.length - 1].data].map((p) => p[1]).concat(plotted.map((p) => p.y));
  const step = niceStep(Math.max(...ys) - Math.min(...ys), 9);
  const yMin = Math.floor(Math.min(...ys) / step) * step;
  const yMax = Math.ceil(Math.max(...ys) / step) * step;
  const yMinorSplit = Math.round(step / Math.pow(10, Math.floor(Math.log10(step) + 1e-9))) === 2 ? 4 : 5;

  const isThisVisit = (point: GrowthChartPoint): boolean =>
    !!thisVisitEncounterId && point.encounterId === thisVisitEncounterId;
  const locate: GrowthChartOption['locate'] = new Map();
  plotted.forEach((point, dataIndex) => locate.set(point, { seriesIndex: curves.length, dataIndex }));
  flagged.forEach((point, dataIndex) => locate.set(point, { seriesIndex: curves.length + 1, dataIndex }));

  const option = {
    tooltip: {
      trigger: 'item',
      // Canvas text, not HTML: nothing in a tooltip can become markup.
      renderMode: 'richText',
      formatter: (params: { data?: { point?: GrowthChartPoint } }) =>
        params.data?.point ? growthTooltip(params.data.point, view) : '',
    },
    // Our own disabled dataZoom keeps the EChart wrapper from adding its slider.
    dataZoom: [{ type: 'inside', disabled: true }],
    grid: {
      left: 56,
      right: view.imperial ? 64 : 40,
      top: 16,
      bottom: 44,
      show: true,
      backgroundColor: pal.tint,
      borderColor: '#9aa5b4',
    },
    xAxis: {
      type: 'value',
      min: xAxis.min,
      max: xAxis.max,
      interval: xAxis.interval,
      name: xAxis.name,
      nameLocation: 'middle',
      nameGap: 28,
      axisLabel: { formatter: xAxis.formatter, fontSize: 10.5, color: '#475569' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: GRID_MAJOR } },
      minorTick: { show: true, splitNumber: xAxis.minorSplit },
      minorSplitLine: { show: true, lineStyle: { color: GRID_MINOR } },
    },
    // The metric axis on the left carries the grid; the imperial axis on the right spans the same range converted,
    // so its ticks sit on the metric gridlines.
    yAxis: [
      {
        type: 'value',
        min: yMin,
        max: yMax,
        interval: step,
        name: view.yLabel,
        nameLocation: 'middle',
        nameGap: 40,
        axisLabel: { fontSize: 10.5, color: '#475569' },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: GRID_MAJOR } },
        minorTick: { show: true, splitNumber: yMinorSplit },
        minorSplitLine: { show: true, lineStyle: { color: GRID_MINOR } },
      },
      ...(view.imperial
        ? [
            {
              type: 'value',
              position: 'right',
              min: view.imperial.convert(yMin),
              max: view.imperial.convert(yMax),
              interval: view.imperial.convert(step),
              name: view.imperial.yLabel,
              nameLocation: 'middle',
              nameGap: 44,
              axisLabel: { fontSize: 10.5, color: '#475569', formatter: (value: number) => fixed(value, 1) },
              axisLine: { show: false },
              axisTick: { show: false },
              splitLine: { show: false },
            },
          ]
        : []),
    ],
    series: [
      ...curves.map(({ pct, data }) => ({
        name: `${pct}`,
        type: 'line',
        data,
        showSymbol: false,
        silent: true,
        tooltip: { show: false },
        lineStyle: {
          color: pct === 50 ? pal.mid : pal.curve,
          width: pct === 50 ? 2.2 : 1.1,
          opacity: pct === 50 ? 1 : 0.75,
        },
        endLabel: {
          show: true,
          formatter: `${pct}`,
          color: pct === 50 ? pal.mid : pal.curve,
          fontWeight: pct === 50 ? 700 : 400,
          fontSize: 10,
          distance: 4,
        },
        labelLayout: { moveOverlap: 'shiftY' },
      })),
      {
        name: 'Patient',
        type: 'line',
        data: plotted.map((point) => ({
          value: [point.x, point.y],
          point,
          symbolSize: isThisVisit(point) ? 11 : 7,
          itemStyle: isThisVisit(point)
            ? { color: '#fff', borderColor: EHR_BLUE, borderWidth: 2.2 }
            : { color: pal.point, borderColor: '#fff', borderWidth: 1.2 },
        })),
        symbol: 'circle',
        showSymbol: true,
        lineStyle: { color: pal.point, width: 1.1, opacity: 0.8 },
        emphasis: { scale: 1.4 },
        z: 10,
      },
      {
        name: 'Implausible',
        type: 'scatter',
        clip: false,
        data: flagged.map((point) => {
          const off = point.y > yMax ? 'up' : point.y < yMin ? 'down' : undefined;
          return {
            value: [point.x, Math.min(yMax, Math.max(yMin, point.y))],
            point,
            symbol: off ? 'arrow' : CROSS,
            symbolRotate: off === 'down' ? 180 : 0,
            symbolSize: off ? 12 : 10,
          };
        }),
        itemStyle: { color: RED },
        z: 11,
      },
    ],
  };
  return { option, locate };
};
