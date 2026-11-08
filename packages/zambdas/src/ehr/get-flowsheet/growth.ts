import { Observation, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { makeVitalsObservationDTO } from 'utils/lib/fhir/vitals';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { FlowsheetReading, FlowsheetValue, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { GROWTH_TABLES, LmsRow } from './growth-tables.generated';
import { describeVisit, groupByEncounter, newestFirst, VisitResources } from './helpers';

// The Growth flowsheet: each visit's weight, height/length, BMI and head circumference with their WHO (birth to
// 24 months) / CDC (2 to 20 years) percentiles. The percentile math and the chart-set rules are ported from the
// OTR-3741 growth-charts report; the LMS tables are generated from the official files (growth-tables.generated.ts).

export interface GrowthFlowsheetResources extends VisitResources {
  observations: Observation[];
  birthDate?: string;
  gender?: Patient['gender'];
}

type GrowthMeasure = 'weight' | 'height' | 'bmi' | 'headCircumference';

// WHO and CDC both turn age in days into months with 365.25 / 12.
const DAYS_PER_MONTH = 30.4375;
const WHO_MAX_MONTHS = 24;
const CDC_MAX_MONTHS = 240;

interface Lms {
  L: number;
  M: number;
  S: number;
}

/** LMS parameters at x, linearly interpolated between the bracketing table rows; undefined outside the table. */
export const lmsAt = (table: LmsRow[], x: number): Lms | undefined => {
  const last = table[table.length - 1];
  if (!(x >= table[0][0] && x <= last[0])) return undefined;
  let i = 1;
  while (i < table.length - 1 && table[i][0] < x) i++;
  const [ax, aL, aM, aS] = table[i - 1];
  const [bx, bL, bM, bS] = table[i];
  const t = (x - ax) / (bx - ax);
  return { L: aL + t * (bL - aL), M: aM + t * (bM - aM), S: aS + t * (bS - aS) };
};

/** The measurement at z-score z: M (1 + L S z)^(1/L), or M e^(S z) when L = 0. */
const valueAtZ = (p: Lms, z: number): number =>
  p.L === 0 ? p.M * Math.exp(p.S * z) : p.M * Math.pow(1 + p.L * p.S * z, 1 / p.L);

/**
 * z-score of y. restricted = WHO's rule for weight-based indicators: beyond ±3 SD, distance is measured in
 * units of the 2-to-3 SD gap instead of the LMS curve, so extreme values are not exaggerated.
 */
export const zOf = (p: Lms, y: number, restricted = false): number => {
  const z = p.L === 0 ? Math.log(y / p.M) / p.S : (Math.pow(y / p.M, p.L) - 1) / (p.L * p.S);
  if (!restricted || Math.abs(z) <= 3) return z;
  const sd3 = valueAtZ(p, z > 0 ? 3 : -3);
  const sd2 = valueAtZ(p, z > 0 ? 2 : -2);
  return z > 0 ? 3 + (y - sd3) / (sd3 - sd2) : -3 + (y - sd3) / (sd2 - sd3);
};

/** CDC's modified z-score (used only for its biologically-implausible-value flags). */
const modifiedZ = (p: Lms, y: number): number =>
  y < p.M ? (y - p.M) / ((p.M - valueAtZ(p, -2)) / 2) : (y - p.M) / ((valueAtZ(p, 2) - p.M) / 2);

/** Standard normal CDF (erf series, accurate to ~1e-10 for |z| <= 5). */
export const normCdf = (z: number): number => {
  if (z <= -5) return 0;
  if (z >= 5) return 1;
  const x = z / Math.SQRT2;
  let term = x;
  let sum = x;
  for (let n = 1; n < 200 && Math.abs(term) > 1e-17; n++) {
    term *= (-x * x) / n;
    sum += term / (2 * n + 1);
  }
  return 0.5 + sum / Math.sqrt(Math.PI);
};

const ordinal = (n: number): string => {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
};

/** "88th", "<1st", ">99th" — as the growth-charts report shows percentiles. */
export const formatPercentile = (z: number): string => {
  const p = normCdf(z) * 100;
  if (p < 1) return '<1st';
  if (p > 99) return '>99th';
  return ordinal(Math.round(p));
};

/** Clinical age style: "3 d", "12 mo", "4 y 6 mo". */
export const formatAge = (months: number): string => {
  if (months < 1) return `${Math.round(months * DAYS_PER_MONTH)} d`;
  if (months < 24) return `${Math.floor(months)} mo`;
  const y = Math.floor(months / 12);
  const m = Math.floor(months - y * 12);
  return `${y} y${m ? ` ${m} mo` : ''}`;
};

/** Age in months from the birth date to the measurement's calendar day in the zone it was recorded in. */
export const ageMonthsAt = (birthDate: string, iso: string): number | undefined => {
  const birth = DateTime.fromISO(birthDate, { zone: 'utc' });
  const day = DateTime.fromISO(iso, { setZone: true }).toISODate();
  if (!birth.isValid || !day) return undefined;
  return DateTime.fromISO(day, { zone: 'utc' }).diff(birth, 'days').days / DAYS_PER_MONTH;
};

interface Indicator {
  table: string;
  /** WHO weight-based indicators use the restricted z-score. */
  restricted?: boolean;
  /** CDC flags on the modified z-score; WHO on the z-score itself. */
  modified?: boolean;
  /** Below the first or above the second the value is biologically implausible and gets no percentile. */
  flag: [number, number];
}

// The chart each measure is read against at an age, with the report's implausible-value limits. WHO has no
// BMI chart in the report's set; head circumference is WHO only (0-24 months), flagged at WHO Anthro's ±5 SD.
const indicatorFor = (measure: GrowthMeasure, ageMonths: number, sex: 'male' | 'female'): Indicator | undefined => {
  if (ageMonths < 0 || ageMonths > CDC_MAX_MONTHS) return undefined;
  const who = ageMonths < WHO_MAX_MONTHS;
  switch (measure) {
    case 'weight':
      return who
        ? { table: `WHO wfa ${sex}`, restricted: true, flag: [-6, 5] }
        : { table: `CDC wfa ${sex}`, modified: true, flag: [-5, 8] };
    case 'height':
      return who
        ? { table: `WHO lfa ${sex}`, flag: [-6, 6] }
        : { table: `CDC sfa ${sex}`, modified: true, flag: [-5, 4] };
    case 'bmi':
      return who ? undefined : { table: `CDC bmi ${sex}`, modified: true, flag: [-4, 8] };
    case 'headCircumference':
      return who ? { table: `WHO hcfa ${sex}`, flag: [-5, 5] } : undefined;
  }
};

/** The percentile text for a measurement, 'implausible' when flagged, undefined when no table covers it. */
export const percentileOf = (
  measure: GrowthMeasure,
  value: number,
  ageMonths: number,
  sex: 'male' | 'female'
): string | undefined => {
  const indicator = indicatorFor(measure, ageMonths, sex);
  const p = indicator && lmsAt(GROWTH_TABLES[indicator.table], ageMonths);
  if (!indicator || !p) return undefined;
  const z = zOf(p, value, indicator.restricted);
  const flagZ = indicator.modified ? modifiedZ(p, value) : z;
  if (flagZ < indicator.flag[0] || flagZ > indicator.flag[1]) return 'implausible';
  return formatPercentile(z);
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

export const buildGrowthFlowsheet = (resources: GrowthFlowsheetResources): FlowsheetVisit[] => {
  // Percentiles need a full birth date and a male/female sex (the references are sex-specific).
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(resources.birthDate ?? '') ? resources.birthDate : undefined;
  const sex = resources.gender === 'male' || resources.gender === 'female' ? resources.gender : undefined;

  const visits: FlowsheetVisit[] = [];
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
      const ageMonths = birthDate ? ageMonthsAt(birthDate, reading.time) : undefined;
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

    // BMI from the visit's latest weight and height, as growth charts conventionally do.
    const weight = values.weight;
    const height = values.height;
    if (typeof weight?.value === 'number' && typeof height?.value === 'number') {
      addWithPercentile('bmi', {
        time: later(weight.time, height.time),
        value: weight.value / Math.pow(height.value / 100, 2),
      });
    }

    const ageMonths = birthDate ? ageMonthsAt(birthDate, start) : undefined;
    if (ageMonths !== undefined && ageMonths >= 0) add('age', { time: start, value: formatAge(ageMonths) });

    visits.push({ ...visit, start, values });
  });

  return newestFirst(visits);
};
