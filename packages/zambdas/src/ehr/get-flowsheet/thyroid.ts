import { FlowsheetDiagnosis, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { conditionColumns, LabRow } from './columns';
import { FlowsheetData, FlowsheetDataKind } from './patient-data';

export const THYROID_DATA_KINDS: FlowsheetDataKind[] = ['vitals', 'diagnoses', 'medications', 'labs'];

/** The vitals rows the Thyroid flowsheet shows; every other vital stays on the Vitals flowsheet. */
const VITAL_KEYS = ['weight', 'heartRate'];

/** ICD-10 disorders of the thyroid gland (E00–E07). */
const THYROID_ICD10_PREFIXES = ['E00', 'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07'];

const THYROID_MEDICATION =
  /levothyroxine|synthroid|levoxyl|unithroid|tirosint|liothyronine|cytomel|armour|desiccated|methimazole|tapazole|propylthiouracil|\bptu\b/i;

/**
 * Lab rows (codes: lab-row-rules.ts). The name patterns only place uncoded results: the free hormones are listed
 * before the totals, and a total row never takes a result whose name says "free".
 */
const LAB_ROWS: LabRow[] = [
  { key: 'tsh', analyte: /\btsh\b|thyrotropin|thyroid stimulating/i, exclude: /receptor|antibod|binding|globulin/i },
  { key: 'freeT4', analyte: /free t4|ft4|thyroxine.*free/i },
  { key: 'totalT4', analyte: /^t4\b|total t4|thyroxine/i, exclude: /free|receptor|antibod|binding|globulin/i },
  { key: 'freeT3', analyte: /free t3|ft3|t3.*free/i },
  { key: 'totalT3', analyte: /^t3\b|total t3|triiodothyronine/i, exclude: /free/i },
  { key: 'tpoAntibodies', analyte: /tpo|peroxidase/i },
];

const unique = (names: string[]): string[] => [...new Set(names)];

const diagnosisText = (diagnoses: FlowsheetDiagnosis[]): string =>
  diagnoses.map((d) => [d.code, d.display].filter(Boolean).join(' — ')).join('; ');

export const buildThyroidFlowsheet = (data: FlowsheetData): FlowsheetVisit[] => {
  const columns = conditionColumns(data, VITAL_KEYS);
  columns.addLabs(LAB_ROWS);

  Object.entries(data.diagnoses ?? {}).forEach(([encounterId, diagnoses]) => {
    const thyroid = diagnoses.filter((d) => THYROID_ICD10_PREFIXES.some((prefix) => d.code.startsWith(prefix)));
    if (thyroid.length === 0) return;
    const visit = columns.columnFor(encounterId, undefined);
    if (!visit) return;
    columns.addReading(visit, 'thyroidDiagnosis', { time: visit.start, value: diagnosisText(thyroid) });
  });

  Object.entries(data.medications ?? {}).forEach(([encounterId, medications]) => {
    const drugs = medications.filter((m) => THYROID_MEDICATION.test(m.name));
    if (drugs.length === 0) return;
    const visit = columns.columnFor(encounterId, drugs.map((m) => m.time).find(Boolean));
    if (!visit) return;
    columns.addReading(visit, 'thyroidMedication', {
      time: drugs[0].time ?? visit.start,
      value: unique(drugs.map((drug) => drug.name)).join('; '),
    });
  });

  // A visit is a column only when it holds something thyroid-related; vitals alone do not put it on the flowsheet.
  return columns.list();
};
