import type { Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { GROWTH_TABLES, GrowthSex, GrowthTableName, LmsRow } from './growthTables';

// The vitals the charts draw (patient-vitals-field tags) and the units they must be recorded in.
const VITAL_TAG_SYSTEM = 'patient-vitals-field';
type VitalTag = 'vital-weight' | 'vital-height';
const UNITS_OK: Record<VitalTag, string[]> = { 'vital-weight': ['kg'], 'vital-height': ['cm'] };
const isVitalTag = (code: string | undefined): code is VitalTag => code === 'vital-weight' || code === 'vital-height';

export const DAYS_PER_MONTH = 30.4375; // WHO and CDC both turn age in days into months with 365.25 / 12

// ---- LMS math ----

export interface Lms {
  L: number;
  M: number;
  S: number;
}

// LMS parameters at x, linearly interpolated between the bracketing table rows; undefined outside the table.
export function lmsAt(table: LmsRow[], x: number): Lms | undefined {
  const last = table[table.length - 1];
  if (!(x >= table[0][0] && x <= last[0])) return undefined;
  let i = 1;
  while (i < table.length - 1 && table[i][0] < x) i++;
  const a = table[i - 1];
  const b = table[i];
  const t = (x - a[0]) / (b[0] - a[0]);
  return { L: a[1] + t * (b[1] - a[1]), M: a[2] + t * (b[2] - a[2]), S: a[3] + t * (b[3] - a[3]) };
}

// The measurement at z-score z (the percentile curves): M (1 + L S z)^(1/L), or M e^(S z) when L = 0.
export function valueAtZ(p: Lms, z: number): number {
  return p.L === 0 ? p.M * Math.exp(p.S * z) : p.M * Math.pow(1 + p.L * p.S * z, 1 / p.L);
}

// z-score of y. restricted = WHO's rule for weight-based indicators: beyond ±3 SD, distance is measured in
// units of the 2-to-3 SD gap instead of the LMS curve, so extreme values are not exaggerated.
export function zOf(p: Lms, y: number, restricted?: boolean): number {
  const z = p.L === 0 ? Math.log(y / p.M) / p.S : (Math.pow(y / p.M, p.L) - 1) / (p.L * p.S);
  if (!restricted || Math.abs(z) <= 3) return z;
  const sd3 = valueAtZ(p, z > 0 ? 3 : -3);
  const sd2 = valueAtZ(p, z > 0 ? 2 : -2);
  return z > 0 ? 3 + (y - sd3) / (sd3 - sd2) : -3 + (y - sd3) / (sd2 - sd3);
}

// CDC's modified z-score (used only for its biologically-implausible-value flags).
export function modifiedZ(p: Lms, y: number): number {
  return y < p.M ? (y - p.M) / ((p.M - valueAtZ(p, -2)) / 2) : (y - p.M) / ((valueAtZ(p, 2) - p.M) / 2);
}

// Standard normal CDF (erf series, accurate to ~1e-10 for |z| ≤ 5), and its inverse by bisection.
export function normCdf(z: number): number {
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
}

export function zForPercentile(pct: number): number {
  let lo = -5;
  let hi = 5;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (normCdf(mid) < pct / 100) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---- formatting ----

export const round = (value: number, digits: number): number => Math.round(value * 10 ** digits) / 10 ** digits;

export function fmtAge(months: number): string {
  if (months < 1) return Math.round(months * DAYS_PER_MONTH) + ' d';
  if (months < 24) return Math.floor(months) + ' mo';
  const y = Math.floor(months / 12);
  const m = Math.floor(months - y * 12);
  return y + ' y' + (m ? ' ' + m + ' mo' : '');
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function fmtPercentile(z: number): string {
  const p = normCdf(z) * 100;
  if (p < 1) return '<1st';
  if (p > 99) return '>99th';
  return ordinal(Math.round(p));
}

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

// ---- the patient ----

export const isFullBirthDate = (birthDate: string | undefined): birthDate is string =>
  /^\d{4}-\d{2}-\d{2}$/.test(birthDate ?? '');

export const growthSexOf = (gender: string | undefined): GrowthSex | undefined =>
  gender === 'male' || gender === 'female' ? gender : undefined;

// Age in months from the birth date to the measurement's calendar day in the viewer's time zone.
export function ageMonthsAt(birthDate: string, iso: string): number {
  const b = birthDate.split('-').map(Number);
  const d = (DateTime.fromISO(iso).toLocal().toISODate() ?? '').split('-').map(Number);
  return (Date.UTC(d[0], d[1] - 1, d[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / 864e5 / DAYS_PER_MONTH;
}

// ---- the charts ----

export type MeasureKind = 'weight' | 'height' | 'bmi';

export interface ChartDef {
  id: string;
  title: string;
  table: GrowthTableName;
  kind: MeasureKind;
  x: 'age' | 'length';
  yLabel: string;
  unit: string;
  digits: number;
  /** WHO's restricted z for weight-based indicators (see zOf). */
  restricted?: boolean;
  /** The z range outside which a value is biologically implausible. */
  flag: [low: number, high: number];
  /** CDC flags by its modified z rather than the z itself. */
  flagByModifiedZ?: boolean;
}

export interface ChartSet {
  label: string;
  ageMin: number;
  ageMax: number;
  pcts: number[];
  charts: ChartDef[];
}

export type ChartSetId = 'who' | 'cdc';

export const CHART_SETS: Record<ChartSetId, ChartSet> = {
  who: {
    label: 'Birth to 24 months (WHO)',
    ageMin: 0,
    ageMax: 24,
    pcts: [2, 5, 10, 25, 50, 75, 90, 95, 98],
    charts: [
      {
        id: 'wfa',
        title: 'Weight-for-age',
        table: 'WHO wfa',
        kind: 'weight',
        x: 'age',
        yLabel: 'Weight (kg)',
        unit: 'kg',
        digits: 2,
        restricted: true,
        flag: [-6, 5],
      },
      {
        id: 'lfa',
        title: 'Length-for-age',
        table: 'WHO lfa',
        kind: 'height',
        x: 'age',
        yLabel: 'Length (cm)',
        unit: 'cm',
        digits: 1,
        flag: [-6, 6],
      },
      {
        id: 'wfl',
        title: 'Weight-for-length',
        table: 'WHO wfl',
        kind: 'weight',
        x: 'length',
        yLabel: 'Weight (kg)',
        unit: 'kg',
        digits: 2,
        restricted: true,
        flag: [-5, 5],
      },
    ],
  },
  cdc: {
    label: '2 to 20 years (CDC)',
    ageMin: 24,
    ageMax: 240,
    pcts: [3, 5, 10, 25, 50, 75, 90, 95, 97],
    charts: [
      {
        id: 'wfa',
        title: 'Weight-for-age',
        table: 'CDC wfa',
        kind: 'weight',
        x: 'age',
        yLabel: 'Weight (kg)',
        unit: 'kg',
        digits: 1,
        flag: [-5, 8],
        flagByModifiedZ: true,
      },
      {
        id: 'sfa',
        title: 'Stature-for-age',
        table: 'CDC sfa',
        kind: 'height',
        x: 'age',
        yLabel: 'Stature (cm)',
        unit: 'cm',
        digits: 1,
        flag: [-5, 4],
        flagByModifiedZ: true,
      },
      {
        id: 'bmi',
        title: 'BMI-for-age',
        table: 'CDC bmi',
        kind: 'bmi',
        x: 'age',
        yLabel: 'BMI (kg/m²)',
        unit: 'kg/m²',
        digits: 1,
        flag: [-4, 8],
        flagByModifiedZ: true,
      },
    ],
  },
};

export const tableFor = (chart: ChartDef, sex: GrowthSex): LmsRow[] => GROWTH_TABLES[`${chart.table} ${sex}`];

// The z a value is flagged by on this chart, and whether it is outside the chart's plausible range.
function flagZ(chart: ChartDef, p: Lms, y: number): { fz: number; implausible: boolean } {
  const fz = chart.flagByModifiedZ ? modifiedZ(p, y) : zOf(p, y, chart.restricted);
  return { fz, implausible: fz < chart.flag[0] || fz > chart.flag[1] };
}

// ---- the measurements ----

export interface Measurement {
  kind: MeasureKind;
  at: string;
  /** Missing when the Observation has no value (a refused weight). */
  value?: number;
  issue?: string;
  ageMo: number;
  enc?: string;
  /** Weight only: the same visit's length, for weight-for-length. */
  length?: number;
  lengthFrom?: Measurement;
  /** BMI only: the weight and height it was computed from. */
  from?: Measurement[];
  implausible?: boolean;
}

function vitalTag(o: Observation): VitalTag | undefined {
  const code = o.meta?.tag?.find((t) => t.system?.includes(VITAL_TAG_SYSTEM) && isVitalTag(t.code))?.code;
  return isVitalTag(code) ? code : undefined;
}

// One weight and one height per visit (the last taken, like the grid); BMI only from a pair of the same visit.
// Weights and heights implausible on their age chart are flagged, so the BMI and weight-for-length built on them are too.
export function growthMeasurements(observations: Observation[], birthDate: string, sex: GrowthSex): Measurement[] {
  const lastBy: Record<string, { o: Observation; at: string; tag: VitalTag }> = {};
  observations.forEach((o) => {
    const tag = vitalTag(o);
    if (!tag) return;
    const at = o.effectiveDateTime || o.effectivePeriod?.start;
    if (!at) return;
    const key = (o.encounter?.reference || 'Observation/' + o.id) + '|' + tag;
    if (!lastBy[key] || lastBy[key].at < at) lastBy[key] = { o, at, tag };
  });

  const byVisit: Record<string, { weight?: Measurement; height?: Measurement }> = {};
  const out: Measurement[] = [];
  Object.keys(lastBy).forEach((key) => {
    const { o, at, tag } = lastBy[key];
    const q = o.valueQuantity ?? {};
    const unit = String(q.unit || q.code || '').trim();
    let issue: string | undefined;
    if (typeof q.value !== 'number' || !(q.value > 0)) issue = 'no usable value';
    else if (UNITS_OK[tag].indexOf(unit.toLowerCase()) < 0) {
      issue = 'unit "' + (unit || 'none') + '" — not converted to ' + UNITS_OK[tag][0];
    }
    const kind = tag === 'vital-weight' ? 'weight' : 'height';
    const m: Measurement = {
      kind,
      at,
      value: q.value,
      issue,
      ageMo: ageMonthsAt(birthDate, at),
      enc: o.encounter?.reference,
    };
    out.push(m);
    const visit = key.split('|')[0];
    byVisit[visit] = { ...byVisit[visit], [kind]: m };
  });

  Object.values(byVisit).forEach(({ weight, height }) => {
    if (!weight || !height || weight.issue || height.issue) return;
    if (weight.value === undefined || height.value === undefined) return;
    weight.length = height.value; // weight-for-length pairs the weight with the same visit's length
    weight.lengthFrom = height;
    out.push({
      kind: 'bmi',
      at: weight.at,
      value: weight.value / Math.pow(height.value / 100, 2),
      ageMo: weight.ageMo,
      from: [weight, height],
      enc: weight.enc,
    });
  });
  out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  out.forEach((m) => {
    if (m.kind === 'bmi' || m.issue || m.value === undefined) return;
    const set = m.ageMo < 24 ? CHART_SETS.who : CHART_SETS.cdc;
    const chart = set.charts.find((c) => c.kind === m.kind && c.x === 'age');
    const p = chart && m.ageMo >= 0 && m.ageMo <= 240 ? lmsAt(tableFor(chart, sex), m.ageMo) : undefined;
    if (!chart || !p) return;
    m.implausible = flagZ(chart, p, m.value).implausible;
  });
  return out;
}

export interface ChartRow {
  m: Measurement;
  /** Age in months, or length in cm on weight-for-length. */
  x?: number;
  y?: number;
  z?: number;
  note: string;
  implausible?: boolean;
  plotted: boolean;
}

// The rows of one chart: x, percentile, z-score, and whether the point is plotted or flagged.
export function chartRows(
  set: ChartSet,
  chart: ChartDef,
  growth: Measurement[],
  sex: GrowthSex
): { rows: ChartRow[]; otherAges: number; table: LmsRow[] } {
  const table = tableFor(chart, sex);
  const rows: ChartRow[] = [];
  let otherAges = 0;
  growth.forEach((m) => {
    if (m.kind !== chart.kind) return;
    if (chart.x === 'length' && m.length == null && !m.issue) return; // weight without a same-visit length
    if (!(m.ageMo >= set.ageMin && (m.ageMo < set.ageMax || (set.ageMax === 240 && m.ageMo <= 240)))) {
      otherAges++;
      return;
    }
    const x = chart.x === 'age' ? m.ageMo : m.length;
    const r: ChartRow = { m, x, y: m.value, note: m.issue || '', plotted: false };
    const p = r.note || x === undefined ? undefined : lmsAt(table, x);
    if (!r.note && !p) r.note = chart.x === 'length' ? 'length outside the 45–110 cm table' : 'outside the table';
    if (p && r.y !== undefined) {
      r.z = zOf(p, r.y, chart.restricted);
      const { fz, implausible } = flagZ(chart, p, r.y);
      if (implausible) {
        r.implausible = true;
        r.note =
          'implausible (' +
          (chart.flagByModifiedZ ? 'modified ' : '') +
          'z ' +
          fz.toFixed(1) +
          ') — not plotted on the line';
      }
    }
    const sources = chart.kind === 'bmi' ? m.from ?? [] : chart.x === 'length' && m.lengthFrom ? [m, m.lengthFrom] : [];
    const bad = sources.filter((s) => s.implausible).map((s) => s.kind);
    if (bad.length && !r.implausible && r.z !== undefined) {
      r.implausible = true;
      r.note = 'from an implausible ' + bad.join(' and ') + ' — not plotted on the line';
    }
    r.plotted = r.z !== undefined && !r.implausible;
    rows.push(r);
  });
  return { rows, otherAges, table };
}
