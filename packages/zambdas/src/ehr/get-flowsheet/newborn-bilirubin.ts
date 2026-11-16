import { DateTime } from 'luxon';
import { FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { byInstant, conditionColumns, LabRow } from './columns';
import { describeVisit } from './helpers';
import { FlowsheetData, FlowsheetDataKind } from './patient-data';

export const NEWBORN_BILIRUBIN_DATA_KINDS: FlowsheetDataKind[] = ['birthDate', 'birthHistory', 'vitals', 'labs'];

/** The vitals rows the Newborn bilirubin flowsheet shows; every other vital stays on the Vitals flowsheet. */
const VITAL_KEYS = ['weight'];

/**
 * Lab rows (codes: lab-row-rules.ts). The name patterns only place uncoded results: the direct and transcutaneous
 * rows are listed before total, so a total row never takes a result whose name says either.
 */
const LAB_ROWS: LabRow[] = [
  {
    key: 'newbornDirectBilirubin',
    analyte: /bilirubin.*(direct|conjugated)|(direct|conjugated).*bilirubin/i,
    exclude: /indirect|unconjugated|cord/i,
    excludeTest: /cord/i,
  },
  { key: 'transcutaneousBilirubin', analyte: /transcutaneous|\btcb\b/i },
  {
    key: 'newbornTotalBilirubin',
    analyte: /bilirubin/i,
    exclude: /direct|conjugated|indirect|unconjugated|cord/i,
    // A urine or cord blood bilirubin (in its name or its test's) is not the infant's blood result.
    excludeTest: /urin|\bua\b|cord/i,
  },
];

/**
 * Whole days from the birth date to the instant's calendar day in `zone` (the visit location's), else in the zone
 * it was recorded in.
 */
export const dayOfLifeAt = (birthDate: string, iso: string, zone?: string): number | undefined => {
  const birth = DateTime.fromISO(birthDate, { zone: 'utc' });
  const recorded = DateTime.fromISO(iso, { setZone: true });
  const local = zone ? recorded.setZone(zone) : recorded;
  const day = (local.isValid ? local : recorded).toISODate();
  if (!birth.isValid || !day) return undefined;
  return Math.floor(DateTime.fromISO(day, { zone: 'utc' }).diff(birth, 'days').days);
};

/**
 * Hours from the birth instant (birth date + time of birth, read in `zone`, the visit location's, else in the zone
 * the instant was recorded in) to the instant; undefined when either is invalid.
 */
export const hoursOfLifeAt = (
  birthDate: string,
  timeOfBirth: string,
  iso: string,
  zone?: string
): number | undefined => {
  const recorded = DateTime.fromISO(iso, { setZone: true });
  const local = zone ? recorded.setZone(zone) : recorded;
  const at = local.isValid ? local : recorded;
  const birth = DateTime.fromISO(`${birthDate}T${timeOfBirth}`, { zone: at.zoneName ?? undefined });
  if (!birth.isValid || !at.isValid) return undefined;
  return at.diff(birth, 'hours').hours;
};

/**
 * Results up to 2 months of life: the first-week checks and the prolonged-jaundice tests at 2–4 weeks with their
 * repeats (NASPGHAN/ESPGHAN 2017). A later bilirubin (an older child's or adult's CMP) stays on Lab results.
 */
const NEWBORN_MONTHS = 2;

export const buildNewbornBilirubinFlowsheet = (data: FlowsheetData): FlowsheetVisit[] => {
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(data.birthDate ?? '') ? data.birthDate : undefined;
  // The last day of life kept, counted like the Day of life row: by calendar day in the visit's zone.
  const birth = birthDate ? DateTime.fromISO(birthDate, { zone: 'utc' }) : undefined;
  const lastDay = birth?.plus({ months: NEWBORN_MONTHS }).diff(birth, 'days').days;
  // Without a birth date a newborn's result can't be told from an adult's, so none is placed.
  const labs =
    birthDate && lastDay !== undefined && data.labs
      ? Object.fromEntries(
          Object.entries(data.labs).map(([key, results]) => {
            const zone = describeVisit(key, data).timezone;
            // An undated result (no effective or issued time) can't be placed, so it stays.
            return [
              key,
              results.filter(
                (result) =>
                  !result.resultedAt || (dayOfLifeAt(birthDate, result.resultedAt, zone) ?? Infinity) <= lastDay
              ),
            ];
          })
        )
      : {};
  const columns = conditionColumns({ ...data, labs }, VITAL_KEYS);
  columns.addLabs(LAB_ROWS);

  // A visit is a column only when it holds a bilirubin result; weight alone does not put it on the flowsheet.
  const visits = columns.list();
  const timeOfBirth = data.birthHistory?.timeOfBirth;
  // One day-of-life reading per day with results, so a result from the day after the visit shows its own day, and
  // (with a time of birth) one hours-of-life reading per result time: the chart's x-axis when known.
  visits.forEach((visit) => {
    if (!birthDate) return;
    const resultTimes = Object.entries(visit.values)
      .filter(([key]) => !VITAL_KEYS.includes(key))
      .flatMap(([, value]) => value.readings.map((reading) => reading.time));
    [...new Set(resultTimes)].sort(byInstant).forEach((time) => {
      const dayOfLife = dayOfLifeAt(birthDate, time, visit.timezone);
      const days = visit.values.dayOfLife?.readings.map((reading) => reading.value) ?? [];
      if (dayOfLife !== undefined && !days.includes(dayOfLife))
        columns.addReading(visit, 'dayOfLife', { time, value: dayOfLife });
      const hoursOfLife = timeOfBirth ? hoursOfLifeAt(birthDate, timeOfBirth, time, visit.timezone) : undefined;
      if (hoursOfLife !== undefined) columns.addReading(visit, 'hoursOfLife', { time, value: hoursOfLife });
    });
  });
  return visits;
};
