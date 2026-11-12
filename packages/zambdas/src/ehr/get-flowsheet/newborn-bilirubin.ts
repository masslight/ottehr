import { DateTime } from 'luxon';
import { FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { conditionColumns, LabRow } from './columns';
import { FlowsheetData, FlowsheetDataKind } from './patient-data';

export const NEWBORN_BILIRUBIN_DATA_KINDS: FlowsheetDataKind[] = ['birthDate', 'vitals', 'labs'];

/** The vitals rows the Newborn bilirubin flowsheet shows; every other vital stays on the Vitals flowsheet. */
const VITAL_KEYS = ['weight'];

/**
 * Lab rows (codes: lab-row-rules.ts). The name patterns only place uncoded results: the direct and transcutaneous
 * rows are listed before total, so a total row never takes a result whose name says either.
 */
const LAB_ROWS: LabRow[] = [
  {
    key: 'directBilirubin',
    analyte: /bilirubin.*(direct|conjugated)|(direct|conjugated).*bilirubin/i,
    exclude: /indirect|unconjugated/i,
  },
  { key: 'transcutaneousBilirubin', analyte: /transcutaneous|\btcb\b/i },
  { key: 'totalBilirubin', analyte: /bilirubin/i, exclude: /direct|conjugated|indirect|unconjugated/i },
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

export const buildNewbornBilirubinFlowsheet = (data: FlowsheetData): FlowsheetVisit[] => {
  const columns = conditionColumns(data, VITAL_KEYS);
  columns.addLabs(LAB_ROWS);

  // A visit is a column only when it holds a bilirubin result; weight alone does not put it on the flowsheet.
  const visits = columns.list();
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(data.birthDate ?? '') ? data.birthDate : undefined;
  // One day-of-life reading per result time, so a result from the day after the visit shows its own day.
  visits.forEach((visit) => {
    if (!birthDate) return;
    const resultTimes = Object.entries(visit.values)
      .filter(([key]) => !VITAL_KEYS.includes(key))
      .flatMap(([, value]) => value.readings.map((reading) => reading.time));
    [...new Set(resultTimes)].sort().forEach((time) => {
      const dayOfLife = dayOfLifeAt(birthDate, time, visit.timezone);
      if (dayOfLife !== undefined) columns.addReading(visit, 'dayOfLife', { time, value: dayOfLife });
    });
  });
  return visits;
};
