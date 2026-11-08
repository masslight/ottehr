import { DateTime } from 'luxon';
import { FlowsheetLabResult, FlowsheetReading, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { buildVitalsFlowsheet, describeVisit, newestFirst } from './helpers';
import { FlowsheetData, FlowsheetDataKind } from './patient-data';

export const NEWBORN_BILIRUBIN_DATA_KINDS: FlowsheetDataKind[] = ['birthDate', 'vitals', 'labs'];

/** The vitals rows the Newborn bilirubin flowsheet shows; every other vital stays on the Vitals flowsheet. */
const VITAL_KEYS = ['weight'];

/**
 * Lab rows: a result matches by one of its LOINC codes first, else by its analyte name. The direct and
 * transcutaneous rows are listed before total, so a total row never takes a result whose name says either.
 */
const LAB_ROWS: { key: string; loinc: string[]; analyte: RegExp; exclude?: RegExp }[] = [
  {
    key: 'directBilirubin',
    loinc: ['1968-7', '29760-6'],
    analyte: /bilirubin.*(direct|conjugated)|(direct|conjugated).*bilirubin/i,
    exclude: /indirect|unconjugated/i,
  },
  { key: 'transcutaneousBilirubin', loinc: ['58941-6'], analyte: /transcutaneous|\btcb\b/i },
  {
    key: 'totalBilirubin',
    loinc: ['1975-2', '14631-6', '42719-5', '35194-0', '59828-4'],
    analyte: /bilirubin/i,
    exclude: /direct|conjugated|indirect|unconjugated/i,
  },
];

const labRowFor = (lab: FlowsheetLabResult): string | undefined =>
  (
    LAB_ROWS.find((row) => lab.loincCodes.some((code) => row.loinc.includes(code))) ??
    LAB_ROWS.find((row) => row.analyte.test(lab.analyte) && !row.exclude?.test(lab.analyte))
  )?.key;

const byResultedAt = (a: FlowsheetLabResult, b: FlowsheetLabResult): number =>
  (a.resultedAt ?? '').localeCompare(b.resultedAt ?? '');

/** Whole days from the birth date to the instant's calendar day in the zone it was recorded in. */
export const dayOfLifeAt = (birthDate: string, iso: string): number | undefined => {
  const birth = DateTime.fromISO(birthDate, { zone: 'utc' });
  const day = DateTime.fromISO(iso, { setZone: true }).toISODate();
  if (!birth.isValid || !day) return undefined;
  return Math.floor(DateTime.fromISO(day, { zone: 'utc' }).diff(birth, 'days').days);
};

export const buildNewbornBilirubinFlowsheet = (data: FlowsheetData): FlowsheetVisit[] => {
  // Keyed like the vitals builder groups them: by encounter id, '' for readings not linked to a visit.
  const visits = new Map<string, FlowsheetVisit>();
  buildVitalsFlowsheet({ ...data, observations: data.vitals ?? [] }).forEach((visit) => {
    const values = Object.fromEntries(Object.entries(visit.values).filter(([key]) => VITAL_KEYS.includes(key)));
    if (Object.keys(values).length > 0) visits.set(visit.encounterId ?? '', { ...visit, values });
  });

  // A visit without vitals is dated by its appointment, else by the result that puts it on the flowsheet.
  const visitFor = (encounterId: string, fallbackStart: string | undefined): FlowsheetVisit | undefined => {
    const existing = visits.get(encounterId);
    if (existing) return existing;
    const described = describeVisit(encounterId, data);
    const start = described.start ?? fallbackStart;
    if (!start) return undefined;
    const visit = { ...described, start, values: {} };
    visits.set(encounterId, visit);
    return visit;
  };
  const addReading = (visit: FlowsheetVisit, key: string, reading: FlowsheetReading): void => {
    visit.values[key] = { ...reading, readings: [...(visit.values[key]?.readings ?? []), reading] };
  };

  Object.entries(data.labs ?? {}).forEach(([encounterId, labs]) => {
    // Oldest first, so the latest result of each kind in the visit is the cell value; every one is kept.
    // Only numeric results are shown.
    const matched = labs
      .filter((lab) => lab.value !== undefined)
      .flatMap((lab) => {
        const key = labRowFor(lab);
        return key ? [{ key, lab }] : [];
      })
      .sort((a, b) => byResultedAt(a.lab, b.lab));
    if (matched.length === 0) return;
    const visit = visitFor(encounterId, matched[0].lab.resultedAt);
    if (!visit) return;
    matched.forEach(({ key, lab }) => {
      addReading(visit, key, {
        time: lab.resultedAt ?? visit.start,
        value: lab.value as number,
        unit: lab.unit || undefined,
        flag: lab.flag,
      });
    });
  });

  // A visit is a column only when it holds a bilirubin result; weight alone does not put it on the flowsheet.
  const columns = [...visits.values()].filter((visit) =>
    Object.keys(visit.values).some((key) => !VITAL_KEYS.includes(key))
  );
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(data.birthDate ?? '') ? data.birthDate : undefined;
  columns.forEach((visit) => {
    const dayOfLife = birthDate ? dayOfLifeAt(birthDate, visit.start) : undefined;
    if (dayOfLife !== undefined) addReading(visit, 'dayOfLife', { time: visit.start, value: dayOfLife });
  });
  return newestFirst(columns);
};
