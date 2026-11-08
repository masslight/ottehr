import {
  FlowsheetDiagnosis,
  FlowsheetLabResult,
  FlowsheetReading,
  FlowsheetVisit,
} from 'utils/lib/types/api/flowsheets.types';
import { buildVitalsFlowsheet, describeVisit, newestFirst } from './helpers';
import { FlowsheetData, FlowsheetDataKind } from './patient-data';

export const THYROID_DATA_KINDS: FlowsheetDataKind[] = ['vitals', 'diagnoses', 'medications', 'labs'];

/** The vitals rows the Thyroid flowsheet shows; every other vital stays on the Vitals flowsheet. */
const VITAL_KEYS = ['weight', 'heartRate'];

/** ICD-10 disorders of the thyroid gland (E00–E07). */
const THYROID_ICD10_PREFIXES = ['E00', 'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07'];

const THYROID_MEDICATION =
  /levothyroxine|synthroid|levoxyl|unithroid|tirosint|liothyronine|cytomel|armour|desiccated|methimazole|tapazole|propylthiouracil|\bptu\b/i;

/**
 * Lab rows: a result matches by one of its LOINC codes first, else by its analyte name. The free hormones are listed
 * before the totals, and a total row never takes a result whose name says "free".
 */
const LAB_ROWS: { key: string; loinc: string[]; analyte: RegExp; exclude?: RegExp }[] = [
  { key: 'tsh', loinc: ['3016-3', '11580-8', '11579-0'], analyte: /\btsh\b|thyrotropin|thyroid stimulating/i },
  { key: 'freeT4', loinc: ['3024-7', '6892-4'], analyte: /free t4|ft4|thyroxine.*free/i },
  { key: 'totalT4', loinc: ['3026-2'], analyte: /^t4\b|total t4|thyroxine/i, exclude: /free/i },
  { key: 'freeT3', loinc: ['3051-0'], analyte: /free t3|ft3|t3.*free/i },
  { key: 'totalT3', loinc: ['3053-6'], analyte: /^t3\b|total t3|triiodothyronine/i, exclude: /free/i },
];

const labRowFor = (lab: FlowsheetLabResult): string | undefined =>
  (
    LAB_ROWS.find((row) => lab.loincCodes.some((code) => row.loinc.includes(code))) ??
    LAB_ROWS.find((row) => row.analyte.test(lab.analyte) && !row.exclude?.test(lab.analyte))
  )?.key;

const byResultedAt = (a: FlowsheetLabResult, b: FlowsheetLabResult): number =>
  (a.resultedAt ?? '').localeCompare(b.resultedAt ?? '');

const unique = (names: string[]): string[] => [...new Set(names)];

const diagnosisText = (diagnoses: FlowsheetDiagnosis[]): string =>
  diagnoses.map((d) => [d.code, d.display].filter(Boolean).join(' — ')).join('; ');

export const buildThyroidFlowsheet = (data: FlowsheetData): FlowsheetVisit[] => {
  // Keyed like the vitals builder groups them: by encounter id, '' for readings not linked to a visit.
  const visits = new Map<string, FlowsheetVisit>();
  buildVitalsFlowsheet({ ...data, observations: data.vitals ?? [] }).forEach((visit) => {
    const values = Object.fromEntries(Object.entries(visit.values).filter(([key]) => VITAL_KEYS.includes(key)));
    if (Object.keys(values).length > 0) visits.set(visit.encounterId ?? '', { ...visit, values });
  });

  // A visit without vitals is dated by its appointment, else by the data that puts it on the flowsheet.
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
    // Oldest first, so the latest result of each analyte in the visit is the cell value; every one is kept.
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

  Object.entries(data.diagnoses?.byEncounter ?? {}).forEach(([encounterId, diagnoses]) => {
    const thyroid = diagnoses.filter((d) => THYROID_ICD10_PREFIXES.some((prefix) => d.code.startsWith(prefix)));
    if (thyroid.length === 0) return;
    const visit = visitFor(encounterId, undefined);
    if (!visit) return;
    addReading(visit, 'thyroidDiagnosis', { time: visit.start, value: diagnosisText(thyroid) });
  });

  Object.entries(data.medications?.byEncounter ?? {}).forEach(([encounterId, medications]) => {
    const drugs = medications.filter((m) => THYROID_MEDICATION.test(m.name));
    if (drugs.length === 0) return;
    const visit = visitFor(encounterId, drugs.map((m) => m.time).find(Boolean));
    if (!visit) return;
    addReading(visit, 'thyroidMedication', {
      time: drugs[0].time ?? visit.start,
      value: unique(drugs.map((drug) => drug.name)).join('; '),
    });
  });

  // A visit is a column only when it holds something thyroid-related; vitals alone do not put it on the flowsheet.
  return newestFirst(
    [...visits.values()].filter((visit) => Object.keys(visit.values).some((key) => !VITAL_KEYS.includes(key)))
  );
};
