import { BirthHistoryDTO } from 'utils/lib/types/api/birth-history.types';
import { FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { HOURS_OF_LIFE_MAX, hoursOfLifeAt } from './chartPoints';

// "Open in BiliTool": a browser navigation to BiliTool's open results page with the reading(s) prefilled. The host
// is fixed, no token is sent, and every parameter is a number or enum computed here: nothing identifies the patient.
export const BILITOOL_RESULTS_URL = 'https://emr.bilitool.org/results.php';
export const BILITOOL_MIN_GESTATIONAL_WEEKS = 35;
/** BiliTool's top bucket is "40+" weeks. */
export const BILITOOL_MAX_GESTATIONAL_WEEKS = 40;
const MIN_AGE_HOURS = 1;

export type BiliToolUnits = 'US' | 'SI';
export type BiliToolReadingKind = 'blood' | 'tcb';

export interface BiliToolReading {
  kind: BiliToolReadingKind;
  value: number;
  unit: string;
  units: BiliToolUnits;
  /** Hours of life, as recorded (the URL rounds). */
  hours: number;
  time: string;
}

/** The rows of the Newborn bilirubin flowsheet BiliTool can take: serum/blood totals and the skin meter. */
const READING_KINDS: Record<string, BiliToolReadingKind> = {
  newbornTotalBilirubin: 'blood',
  transcutaneousBilirubin: 'tcb',
};

/** BiliTool takes mg/dL (US) or µmol/L (SI); a result in any other unit is not listable. */
export const biliToolUnits = (unit: string): BiliToolUnits | undefined => {
  const lower = unit.trim().toLowerCase();
  if (lower === 'mg/dl') return 'US';
  if (['umol/l', 'µmol/l', 'μmol/l'].includes(lower)) return 'SI';
  return undefined;
};

/** Every listable bilirubin reading within the first 336 hours, newest first. */
export const biliToolReadings = (visits: FlowsheetVisit[]): BiliToolReading[] =>
  visits
    .flatMap((visit) =>
      Object.entries(READING_KINDS).flatMap(([key, kind]) =>
        (visit.values[key]?.readings ?? []).flatMap((reading) => {
          const hours = hoursOfLifeAt(visit, reading.time);
          const units = reading.unit ? biliToolUnits(reading.unit) : undefined;
          if (typeof reading.value !== 'number' || hours === undefined || !units) return [];
          const rounded = Math.round(hours);
          if (rounded < MIN_AGE_HOURS || rounded > HOURS_OF_LIFE_MAX) return [];
          return [{ kind, value: reading.value, unit: reading.unit as string, units, hours, time: reading.time }];
        })
      )
    )
    .sort((a, b) => b.time.localeCompare(a.time));

/** The reading the dialog starts on: the newest blood result; nothing when there is none. */
export const defaultBiliToolReading = (readings: BiliToolReading[]): BiliToolReading | undefined =>
  readings.find((reading) => reading.kind === 'blood');

/** "13.4 mg/dL · blood · 146 h" / "13.9 mg/dL · skin meter (TcB) · 122 h" */
export const formatBiliToolReading = (reading: BiliToolReading): string =>
  `${reading.value} ${reading.unit} · ${reading.kind === 'blood' ? 'blood' : 'skin meter (TcB)'} · ${Math.round(
    reading.hours
  )} h`;

/**
 * Why BiliTool can't take the data yet (the button is shown disabled with this as its hover), or undefined when it
 * can: it needs the time of birth, a gestational age of 35+ weeks and a reading from the first 336 hours.
 */
export const biliToolUnavailableReason = (
  birthHistory: BirthHistoryDTO | undefined,
  readings: BiliToolReading[]
): string | undefined => {
  const missing = [
    !birthHistory?.timeOfBirth && 'time of birth',
    birthHistory?.gestationalAgeWeeks === undefined && 'gestational age',
  ].filter((item): item is string => !!item);
  if (missing.length)
    return `Needs the ${missing.join(' and ')}: add ${
      missing.length > 1 ? 'them' : 'it'
    } in Birth history on a visit's Vitals screen.`;
  if ((birthHistory?.gestationalAgeWeeks ?? 0) < BILITOOL_MIN_GESTATIONAL_WEEKS)
    return `BiliTool covers babies born at ${BILITOOL_MIN_GESTATIONAL_WEEKS} weeks or later.`;
  if (!readings.length) return 'Needs a bilirubin result in mg/dL or µmol/L from the first 14 days (336 hours).';
  return undefined;
};

export interface BiliToolLaunch {
  /** The result to send; the trend is its earlier readings of the same kind. */
  reading: BiliToolReading;
  readings: BiliToolReading[];
  gestationalWeeks: number;
  neuroRiskFactors: boolean;
}

/**
 * The BiliTool results URL: ageHours and totalBilirubin as equal-length lists (oldest first, ending with the chosen
 * reading), whole hours 1–336, one decimal, US|SI, gestational weeks 35–40 (40 = 40+), Yes|No risk factors.
 */
export const buildBiliToolUrl = ({ reading, readings, gestationalWeeks, neuroRiskFactors }: BiliToolLaunch): string => {
  const trend = [
    ...readings
      .filter((r) => r.kind === reading.kind && r.time < reading.time)
      .sort((a, b) => a.time.localeCompare(b.time)),
    reading,
  ];
  const clampHours = (hours: number): number => Math.min(HOURS_OF_LIFE_MAX, Math.max(MIN_AGE_HOURS, Math.round(hours)));
  const weeks = Math.min(
    BILITOOL_MAX_GESTATIONAL_WEEKS,
    Math.max(BILITOOL_MIN_GESTATIONAL_WEEKS, Math.floor(gestationalWeeks))
  );
  const params = new URLSearchParams({
    ageHours: trend.map((r) => String(clampHours(r.hours))).join(','),
    totalBilirubin: trend.map((r) => r.value.toFixed(1)).join(','),
    bilirubinUnits: reading.units,
    gestationalWeeks: String(weeks),
    neuroRiskFactors: neuroRiskFactors ? 'Yes' : 'No',
  });
  return `${BILITOOL_RESULTS_URL}?${params.toString()}`;
};
