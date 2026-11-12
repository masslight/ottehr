import { Observation, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { makeVitalsObservationDTO } from 'utils/lib/fhir/vitals';
import {
  DAYS_PER_MONTH,
  formatAge,
  formatPercentile,
  lmsAt,
  modifiedZ,
  zOf,
} from 'utils/lib/helpers/vitals/growth-lms';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import {
  FlowsheetReading,
  FlowsheetValue,
  FlowsheetVisit,
  GetFlowsheetOutput,
  GROWTH_CHART_IDS,
  GrowthChartData,
  GrowthChartId,
  GrowthChartPoint,
  GrowthChartSet,
} from 'utils/lib/types/api/flowsheets.types';
import { GROWTH_TABLES } from './growth-tables.generated';
import { describeVisit, groupByEncounter, newestFirst, VisitResources } from './helpers';

// The Growth flowsheet: each visit's weight, height/length, BMI and head circumference with their WHO (birth to
// 24 months) / CDC (2 to 20 years) percentiles, plus the points, z-scores and LMS tables the EHR draws the growth
// chart cards from. The rules are ported from the OTR-3741 growth-charts report; the math is in
// utils/lib/helpers/vitals/growth-lms.ts and the LMS tables are generated from the official files
// (growth-tables.generated.ts).

export interface GrowthFlowsheetResources extends VisitResources {
  observations: Observation[];
  birthDate?: string;
  gender?: Patient['gender'];
}

type GrowthMeasure = 'weight' | 'height' | 'bmi' | 'headCircumference';
type Sex = 'male' | 'female';

const WHO_MAX_MONTHS = 24;
const CDC_MAX_MONTHS = 240;

/**
 * Age in months from the birth date to the measurement's calendar day in `zone` (the visit location's), else in
 * the zone it was recorded in.
 */
export const ageMonthsAt = (birthDate: string, iso: string, zone?: string): number | undefined => {
  const birth = DateTime.fromISO(birthDate, { zone: 'utc' });
  const recorded = DateTime.fromISO(iso, { setZone: true });
  const local = zone ? recorded.setZone(zone) : recorded;
  const day = (local.isValid ? local : recorded).toISODate();
  if (!birth.isValid || !day) return undefined;
  return DateTime.fromISO(day, { zone: 'utc' }).diff(birth, 'days').days / DAYS_PER_MONTH;
};

interface GrowthChart {
  set: GrowthChartSet;
  measure: GrowthMeasure;
  /** GROWTH_TABLES key without the sex. */
  table: string;
  /** What the chart's x-axis is: age in months, or (weight-for-length) the same visit's length in cm. */
  x: 'age' | 'length';
  /** WHO weight-based indicators use the restricted z-score. */
  restricted?: boolean;
  /** CDC flags on the modified z-score; WHO on the z-score itself. */
  modified?: boolean;
  /** Below the first or above the second the value is biologically implausible and gets no percentile. */
  flag: [number, number];
}

// The report's chart sets with its implausible-value limits. Head circumference (not in the report, as Ottehr did
// not record it then) is WHO only, flagged at WHO Anthro's ±5 SD.
export const GROWTH_CHARTS: Record<GrowthChartId, GrowthChart> = {
  'who-wfa': { set: 'who', measure: 'weight', table: 'WHO wfa', x: 'age', restricted: true, flag: [-6, 5] },
  'who-lfa': { set: 'who', measure: 'height', table: 'WHO lfa', x: 'age', flag: [-6, 6] },
  'who-wfl': { set: 'who', measure: 'weight', table: 'WHO wfl', x: 'length', restricted: true, flag: [-5, 5] },
  'who-hcfa': { set: 'who', measure: 'headCircumference', table: 'WHO hcfa', x: 'age', flag: [-5, 5] },
  'cdc-wfa': { set: 'cdc', measure: 'weight', table: 'CDC wfa', x: 'age', modified: true, flag: [-5, 8] },
  'cdc-sfa': { set: 'cdc', measure: 'height', table: 'CDC sfa', x: 'age', modified: true, flag: [-5, 4] },
  'cdc-bmi': { set: 'cdc', measure: 'bmi', table: 'CDC bmi', x: 'age', modified: true, flag: [-4, 8] },
};

/** The chart set an age belongs to; undefined before birth and after 20 years. */
export const chartSetAt = (ageMonths: number): GrowthChartSet | undefined =>
  ageMonths < 0 || ageMonths > CDC_MAX_MONTHS ? undefined : ageMonths < WHO_MAX_MONTHS ? 'who' : 'cdc';

/** The age chart a measure is read against at an age (none for BMI under 2 or head circumference from 2). */
const ageChartFor = (measure: GrowthMeasure, ageMonths: number): GrowthChartId | undefined => {
  const set = chartSetAt(ageMonths);
  return GROWTH_CHART_IDS.find((id) => {
    const chart = GROWTH_CHARTS[id];
    return chart.set === set && chart.measure === measure && chart.x === 'age';
  });
};

interface Score {
  z: number;
  percentile: string;
  implausible: boolean;
  /** The z the implausible limits apply to: CDC's modified z, else z. */
  flagZ: number;
}

/** z, percentile and the implausible flag of y at x on a chart; undefined when x is outside its table. */
export const scoreOn = (chartId: GrowthChartId, x: number, y: number, sex: Sex): Score | undefined => {
  const chart = GROWTH_CHARTS[chartId];
  const p = lmsAt(GROWTH_TABLES[`${chart.table} ${sex}`], x);
  if (!p) return undefined;
  const z = zOf(p, y, chart.restricted);
  const flagZ = chart.modified ? modifiedZ(p, y) : z;
  return { z, percentile: formatPercentile(z), implausible: flagZ < chart.flag[0] || flagZ > chart.flag[1], flagZ };
};

const percentileText = (score: Score | undefined): string | undefined =>
  score && (score.implausible ? 'implausible' : score.percentile);

/** The percentile text for a measurement, 'implausible' when flagged, undefined when no table covers it. */
export const percentileOf = (
  measure: GrowthMeasure,
  value: number,
  ageMonths: number,
  sex: Sex
): string | undefined => {
  const chart = ageChartFor(measure, ageMonths);
  return percentileText(chart && scoreOn(chart, ageMonths, value, sex));
};

/**
 * WHO weight-for-length (under 24 months): the percentile of a weight at a length, 'implausible' beyond the
 * report's ±5 limit, undefined when the length is outside the 45-110 cm table.
 */
export const weightForLengthPercentileOf = (weightKg: number, lengthCm: number, sex: Sex): string | undefined =>
  percentileText(scoreOn('who-wfl', lengthCm, weightKg, sex));

const NOT_ON_LINE = '— not plotted on the line';

/**
 * The visit's point on every chart its measurements belong to, as the report's chartRows builds them: one weight,
 * height, BMI and head circumference per visit (the cell values), weight-for-length from the same visit's pair.
 * A measurement outside a chart's set counts in outsideRange instead.
 */
const visitChartPoints = (
  values: Record<string, FlowsheetValue>,
  encounterId: string | undefined,
  ageAt: (time: string) => number | undefined,
  sex: Sex,
  outsideRange: Partial<Record<GrowthChartId, number>>
): GrowthChartPoint[] => {
  const points: GrowthChartPoint[] = [];
  const flagged = (measure: GrowthMeasure): boolean => values[`${measure}Percentile`]?.value === 'implausible';
  GROWTH_CHART_IDS.forEach((id) => {
    const chart = GROWTH_CHARTS[id];
    const measurement = values[chart.measure];
    const length = values.height?.value;
    const ageMonths = typeof measurement?.value === 'number' ? ageAt(measurement.time) : undefined;
    if (typeof measurement?.value !== 'number' || ageMonths === undefined) return;
    if (chart.x === 'length' && typeof length !== 'number') return; // a weight without a same-visit length
    if (chartSetAt(ageMonths) !== chart.set) {
      outsideRange[id] = (outsideRange[id] ?? 0) + 1;
      return;
    }
    const x = chart.x === 'length' && typeof length === 'number' ? length : ageMonths;
    const point: GrowthChartPoint = {
      chart: id,
      encounterId,
      time: measurement.time,
      age: formatAge(ageMonths),
      x,
      y: measurement.value,
    };
    const score = scoreOn(id, x, measurement.value, sex);
    if (!score) {
      points.push({
        ...point,
        note: chart.x === 'length' ? 'length outside the 45–110 cm table' : 'outside the table',
      });
      return;
    }
    // A BMI or weight-for-length built from a flagged weight or height is flagged too.
    const from: GrowthMeasure[] = chart.measure === 'bmi' || chart.x === 'length' ? ['weight', 'height'] : [];
    const bad = from.filter(flagged);
    const note = score.implausible
      ? `implausible (${chart.modified ? 'modified ' : ''}z ${score.flagZ.toFixed(1)}) ${NOT_ON_LINE}`
      : bad.length
      ? `from an implausible ${bad.join(' and ')} ${NOT_ON_LINE}`
      : undefined;
    points.push({ ...point, z: score.z, ...(note ? { implausible: true, note } : { percentile: score.percentile }) });
  });
  return points;
};

const measureOf = (field: VitalFieldNames): GrowthMeasure | undefined => {
  switch (field) {
    case VitalFieldNames.VitalWeight:
      return 'weight';
    case VitalFieldNames.VitalHeight:
      return 'height';
    case VitalFieldNames.VitalHeadCircumference:
      return 'headCircumference';
    default:
      return undefined;
  }
};

const byEffectiveDateTime = (a: Observation, b: Observation): number =>
  (a.effectiveDateTime ?? '').localeCompare(b.effectiveDateTime ?? '');

const later = (a: string, b: string): string => (a > b ? a : b);

/** The grid's visits and, with a full birth date and a male/female sex, the growth-chart data up to asOf. */
export const buildGrowthFlowsheet = (resources: GrowthFlowsheetResources, asOf?: string): GetFlowsheetOutput => {
  // Percentiles need a full birth date and a male/female sex (the references are sex-specific).
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(resources.birthDate ?? '') ? resources.birthDate : undefined;
  const sex = resources.gender === 'male' || resources.gender === 'female' ? resources.gender : undefined;

  const visits: FlowsheetVisit[] = [];
  const points: GrowthChartPoint[] = [];
  const outsideRange: Partial<Record<GrowthChartId, number>> = {};
  groupByEncounter(resources.observations, (o) => o.encounter?.reference).forEach((observations, encounterId) => {
    const visit = describeVisit(encounterId, resources);
    // Oldest first, so the latest reading of each measure is the cell value; every reading is kept.
    observations.sort(byEffectiveDateTime);
    const start = visit.start ?? observations[0]?.effectiveDateTime;
    if (!start) return;

    const values: Record<string, FlowsheetValue> = {};
    const add = (key: string, reading: FlowsheetReading): void => {
      values[key] = { ...reading, readings: [...(values[key]?.readings ?? []), reading] };
    };
    const addWithPercentile = (measure: GrowthMeasure, reading: FlowsheetReading): void => {
      add(measure, reading);
      const ageMonths = birthDate ? ageMonthsAt(birthDate, reading.time, visit.timezone) : undefined;
      const percentile =
        ageMonths !== undefined && sex && typeof reading.value === 'number'
          ? percentileOf(measure, reading.value, ageMonths, sex)
          : undefined;
      if (percentile) add(`${measure}Percentile`, { time: reading.time, value: percentile });
    };

    observations.forEach((o) => {
      const dto = makeVitalsObservationDTO(o);
      const measure = dto && measureOf(dto.field);
      // makeVitalsObservationDTO substitutes 0 for a missing reading; no growth measure can really be 0.
      if (!dto || !measure || !('value' in dto) || !dto.value) return;
      addWithPercentile(measure, { time: o.effectiveDateTime ?? start, value: dto.value });
    });
    // A visit is a column only when it has a weight, length/height or head circumference.
    if (Object.keys(values).length === 0) return;

    // BMI from the visit's latest weight and height, as growth charts conventionally do.
    const weight = values.weight;
    const height = values.height;
    if (typeof weight?.value === 'number' && typeof height?.value === 'number') {
      const time = later(weight.time, height.time);
      addWithPercentile('bmi', { time, value: weight.value / Math.pow(height.value / 100, 2) });

      // Weight-for-length (WHO, under 24 months) pairs the weight with the same visit's length; a pair built
      // from an implausible weight or length is implausible too, as in the report.
      const ageMonths = birthDate ? ageMonthsAt(birthDate, time, visit.timezone) : undefined;
      if (sex && ageMonths !== undefined && ageMonths >= 0 && ageMonths < WHO_MAX_MONTHS) {
        const fromImplausible = [values.weightPercentile, values.heightPercentile].some(
          (p) => p?.value === 'implausible'
        );
        const percentile = fromImplausible
          ? 'implausible'
          : weightForLengthPercentileOf(weight.value, height.value, sex);
        if (percentile) add('weightForLengthPercentile', { time, value: percentile });
      }
    }

    const ageMonths = birthDate ? ageMonthsAt(birthDate, start, visit.timezone) : undefined;
    if (ageMonths !== undefined && ageMonths >= 0) add('age', { time: start, value: formatAge(ageMonths) });

    // The chart points follow the visits shown: none after asOf.
    if (birthDate && sex && (!asOf || Date.parse(start) <= Date.parse(asOf))) {
      const ageAt = (time: string): number | undefined => ageMonthsAt(birthDate, time, visit.timezone);
      points.push(...visitChartPoints(values, visit.encounterId, ageAt, sex, outsideRange));
    }

    visits.push({ ...visit, start, values });
  });

  const growth: GrowthChartData | undefined =
    birthDate && sex
      ? {
          sex,
          ageMonths: ageMonthsAt(birthDate, asOf ?? new Date().toISOString()),
          points: points.sort((a, b) => a.time.localeCompare(b.time)),
          outsideRange,
          tables: Object.fromEntries(
            GROWTH_CHART_IDS.map((id) => [id, GROWTH_TABLES[`${GROWTH_CHARTS[id].table} ${sex}`]])
          ) as GrowthChartData['tables'],
        }
      : undefined;
  return { visits: newestFirst(visits), ...(growth ? { growth } : {}) };
};
