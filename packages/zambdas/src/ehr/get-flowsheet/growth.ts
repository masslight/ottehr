import { Observation, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { makeVitalsObservationDTO } from 'utils/lib/fhir/vitals';
import { gestationalAgeDaysOf } from 'utils/lib/helpers/vitals/birth-history.helper';
import {
  correctedAgeMonths,
  DAYS_PER_MONTH,
  formatAge,
  formatPercentile,
  lmsAt,
  modifiedZ,
  percentOf95thText,
  PRETERM_BEFORE_DAYS,
  valueAtZ,
  Z_95TH,
  zOf,
} from 'utils/lib/helpers/vitals/growth-lms';
import { bmiAppliesAt } from 'utils/lib/helpers/vitals/vitals-bmi.helper';
import { BirthHistoryDTO } from 'utils/lib/types/api/birth-history.types';
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
import { ageInMonthsOnDate } from 'utils/lib/utils/dateUtils';
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
  /** Gestational age at birth, when recorded: preterm infants are read against WHO at their corrected age. */
  birthHistory?: BirthHistoryDTO;
}

/**
 * Age at a measurement. `months` is chronological (days / 30.4375), the age the tables are read at; `calendar` is
 * in calendar months, as the Vitals screen counts them, and labels the age and picks the chart set (`months` when
 * absent). `corrected` is set for preterm infants under 24 months and is the age the WHO tables are read at
 * (negative before the due date: no percentile).
 */
export interface GrowthAge {
  months: number;
  calendar?: number;
  corrected?: number;
}

/** Calendar months, which label the age and pick the chart set. */
const calendarOf = (age: GrowthAge): number => age.calendar ?? age.months;

/** "4 mo", "4 mo (corrected 2 mo)", "5 d (before due date)". */
export const formatGrowthAge = (age: GrowthAge): string => {
  // Under a month the age is in days.
  const chronological = formatAge(calendarOf(age) < 1 ? age.months : calendarOf(age));
  return age.corrected === undefined
    ? chronological
    : `${chronological} (${age.corrected < 0 ? 'before due date' : `corrected ${formatAge(age.corrected)}`})`;
};

/** The chart-reading age: corrected under 24 months when born before 37 weeks, else chronological. */
export const growthAgeOf = (
  ageMonths: number,
  gestationalAgeDays: number | undefined,
  calendarMonths?: number
): GrowthAge => {
  const age = calendarMonths === undefined ? { months: ageMonths } : { months: ageMonths, calendar: calendarMonths };
  return gestationalAgeDays !== undefined &&
    gestationalAgeDays < PRETERM_BEFORE_DAYS &&
    calendarOf(age) < WHO_MAX_MONTHS
    ? { ...age, corrected: correctedAgeMonths(ageMonths, gestationalAgeDays) }
    : age;
};

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
  const day = localDayOf(iso, zone);
  if (!birth.isValid || !day) return undefined;
  return DateTime.fromISO(day, { zone: 'utc' }).diff(birth, 'days').days / DAYS_PER_MONTH;
};

/** Calendar months to the same calendar day, as the Vitals screen counts them (ageInMonthsOnDate). */
export const calendarMonthsAt = (birthDate: string, iso: string, zone?: string): number | undefined => {
  const day = localDayOf(iso, zone);
  return day ? ageInMonthsOnDate(birthDate, day) : undefined;
};

/** The instant's calendar day in `zone`, else in the zone it was recorded in. */
const localDayOf = (iso: string, zone?: string): string | null => {
  const recorded = DateTime.fromISO(iso, { setZone: true });
  const local = zone ? recorded.setZone(zone) : recorded;
  return (local.isValid ? local : recorded).toISODate();
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

/**
 * The age a chart's table is read at: corrected or chronological months. From the 2nd birthday a CDC table starts at
 * 24 months, which days / 30.4375 can fall a day short of.
 */
const tableAge = (chartId: GrowthChartId, age: GrowthAge): number =>
  GROWTH_CHARTS[chartId].set === 'cdc' ? Math.max(age.months, WHO_MAX_MONTHS) : age.corrected ?? age.months;

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
  /** BMI at or above the 95th percentile: its percent of the 95th. */
  percentOf95th?: number;
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
  // Above the 97th the CDC curves can't tell children apart, so a BMI from the 95th up also reads as its percent of
  // the 95th (AAP 2023: severe obesity from 120%).
  const p95 = chart.measure === 'bmi' ? valueAtZ(p, Z_95TH) : undefined;
  const percentOf95th = p95 !== undefined && y >= p95 ? Math.round((100 * y) / p95) : undefined;
  return {
    z,
    percentile: formatPercentile(z),
    ...(percentOf95th !== undefined && { percentOf95th }),
    implausible: flagZ < chart.flag[0] || flagZ > chart.flag[1],
    flagZ,
  };
};

const percentileText = (score: Score | undefined): string | undefined =>
  score && (score.implausible ? 'implausible' : score.percentile + percentOf95thText(score.percentOf95th));

/**
 * The percentile text for a measurement, 'implausible' when flagged, undefined when no table covers it or the
 * (corrected) age is before the due date.
 */
export const percentileOf = (
  measure: GrowthMeasure,
  value: number,
  ageOrMonths: GrowthAge | number,
  sex: Sex
): string | undefined => {
  const age = typeof ageOrMonths === 'number' ? { months: ageOrMonths } : ageOrMonths;
  const chart = ageChartFor(measure, calendarOf(age));
  const x = chart && tableAge(chart, age);
  return percentileText(chart && x !== undefined && x >= 0 ? scoreOn(chart, x, value, sex) : undefined);
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
 * A measurement in the other set's age range counts in outsideRange instead.
 */
const visitChartPoints = (
  values: Record<string, FlowsheetValue>,
  encounterId: string | undefined,
  ageAt: (time: string) => GrowthAge | undefined,
  sex: Sex,
  outsideRange: Partial<Record<GrowthChartId, number>>
): GrowthChartPoint[] => {
  const points: GrowthChartPoint[] = [];
  const flagged = (measure: GrowthMeasure): boolean => values[`${measure}Percentile`]?.value === 'implausible';
  GROWTH_CHART_IDS.forEach((id) => {
    const chart = GROWTH_CHARTS[id];
    const measurement = values[chart.measure];
    const length = values.height?.value;
    const age = typeof measurement?.value === 'number' ? ageAt(measurement.time) : undefined;
    if (typeof measurement?.value !== 'number' || age === undefined) return;
    if (chart.x === 'length' && typeof length !== 'number') return; // a weight without a same-visit length
    const set = chartSetAt(calendarOf(age));
    if (set !== chart.set) {
      // Counted only when the other set's age range has it; one after 20 years is on no chart.
      if (set) outsideRange[id] = (outsideRange[id] ?? 0) + 1;
      return;
    }
    const x = chart.x === 'length' && typeof length === 'number' ? length : tableAge(id, age);
    const point: GrowthChartPoint = {
      chart: id,
      encounterId,
      time: measurement.time,
      age: formatGrowthAge(age),
      x,
      y: measurement.value,
    };
    // Before the due date a preterm infant's point is listed but has no percentile and is not plotted.
    const beforeDueDate = (age.corrected ?? age.months) < 0;
    const score = beforeDueDate ? undefined : scoreOn(id, x, measurement.value, sex);
    if (!score) {
      points.push({
        ...point,
        note: beforeDueDate
          ? 'before the due date'
          : chart.x === 'length'
          ? 'length outside 45–110 cm'
          : "outside the chart's age range",
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
    points.push({
      ...point,
      z: score.z,
      ...(note
        ? { implausible: true, note }
        : {
            percentile: score.percentile,
            ...(score.percentOf95th !== undefined && { percentOf95th: score.percentOf95th }),
          }),
    });
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
  const gestationalAgeDays = gestationalAgeDaysOf(resources.birthHistory);

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
    const ageAt = (time: string): GrowthAge | undefined => {
      const ageMonths = birthDate ? ageMonthsAt(birthDate, time, visit.timezone) : undefined;
      const calendar = birthDate ? calendarMonthsAt(birthDate, time, visit.timezone) : undefined;
      return ageMonths === undefined || calendar === undefined
        ? undefined
        : growthAgeOf(ageMonths, gestationalAgeDays, calendar);
    };
    const addWithPercentile = (measure: GrowthMeasure, reading: FlowsheetReading): void => {
      add(measure, reading);
      const age = ageAt(reading.time);
      const percentile =
        age !== undefined && sex && typeof reading.value === 'number'
          ? percentileOf(measure, reading.value, age, sex)
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

    // BMI from the visit's latest weight and height, as growth charts conventionally do; none under 2 years.
    const weight = values.weight;
    const height = values.height;
    if (typeof weight?.value === 'number' && typeof height?.value === 'number') {
      const time = later(weight.time, height.time);
      const ageMonths = birthDate ? calendarMonthsAt(birthDate, time, visit.timezone) : undefined;
      // A BMI or weight-for-length built from an implausible weight or length is implausible too, as in the report
      // and on the chart.
      const fromImplausible = [values.weightPercentile, values.heightPercentile].some(
        (p) => p?.value === 'implausible'
      );
      if (bmiAppliesAt(ageMonths)) {
        const bmi = { time, value: weight.value / Math.pow(height.value / 100, 2) };
        if (!fromImplausible) addWithPercentile('bmi', bmi);
        else {
          add('bmi', bmi);
          add('bmiPercentile', { time, value: 'implausible' });
        }
      }

      // Weight-for-length (WHO, under 24 months) pairs the weight with the same visit's length.
      // Like the other measures, none before a preterm infant's due date.
      const wflAge = ageAt(time);
      if (sex && wflAge && (wflAge.corrected ?? wflAge.months) >= 0 && calendarOf(wflAge) < WHO_MAX_MONTHS) {
        const percentile = fromImplausible
          ? 'implausible'
          : weightForLengthPercentileOf(weight.value, height.value, sex);
        if (percentile) add('weightForLengthPercentile', { time, value: percentile });
      }
    }

    const age = ageAt(start);
    if (age !== undefined && age.months >= 0) add('age', { time: start, value: formatGrowthAge(age) });

    // The chart points follow the visits shown: none after asOf.
    if (birthDate && sex && (!asOf || Date.parse(start) <= Date.parse(asOf))) {
      points.push(...visitChartPoints(values, visit.encounterId, ageAt, sex, outsideRange));
    }

    visits.push({ ...visit, start, values });
  });

  const growth: GrowthChartData | undefined =
    birthDate && sex
      ? {
          sex,
          ageMonths: calendarMonthsAt(birthDate, asOf ?? new Date().toISOString()),
          points: points.sort((a, b) => a.time.localeCompare(b.time)),
          outsideRange,
          tables: Object.fromEntries(
            GROWTH_CHART_IDS.map((id) => [id, GROWTH_TABLES[`${GROWTH_CHARTS[id].table} ${sex}`]])
          ) as GrowthChartData['tables'],
        }
      : undefined;
  return { visits: newestFirst(visits), ...(growth ? { growth } : {}) };
};
