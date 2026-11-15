import { FlowsheetDiagnosis, FlowsheetMedication, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { MedicationOrderStatuses } from 'utils/lib/types/api/medication-administration.types';
import { conditionColumns, LabRow } from './columns';
import { FlowsheetData, FlowsheetDataKind } from './patient-data';

// The birth date and sex, so the Weight and Heart rate flags are worked out as on the Vitals screen.
export const THYROID_DATA_KINDS: FlowsheetDataKind[] = ['birthDate', 'vitals', 'diagnoses', 'medications', 'labs'];

/** The vitals rows the Thyroid flowsheet shows; every other vital stays on the Vitals flowsheet. */
const VITAL_KEYS = ['weight', 'heartRate'];

/** ICD-10 disorders of the thyroid gland (E00–E07). */
const THYROID_ICD10_PREFIXES = ['E00', 'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07'];

/** Thyroid hormones and antithyroid drugs, by generic or brand name (a saved name may carry only the brand). */
const THYROID_MEDICATION =
  /levothyroxine|synthroid|levoxyl|unithroid|tirosint|euthyrox|levo-?t\b|levothroid|thyquidity|ermeza|eltroxin|liothyronine|cytomel|triostat|liotrix|thyrolar|armour|desiccated|\bthyroid\b|nature-?throid|westhroid|adthyza|methimazole|tapazole|northyx|carbimazole|propylthiouracil|\bptu\b/i;

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
  // Often reported qualitatively ("Negative"), so a text-only result is kept, as on Lab results' qualitative rows.
  { key: 'tpoAntibodies', analyte: /tpo|peroxidase/i, text: true },
];

const unique = (names: string[]): string[] => [...new Set(names)];

/** A drug actually prescribed (eRx, not cancelled, voided or a draft) or given (in-house, fully or partly). */
const prescribedOrGiven = (medication: FlowsheetMedication): boolean =>
  medication.source === 'eRx'
    ? !['cancelled', 'entered-in-error', 'draft'].includes(medication.status)
    : medication.status === MedicationOrderStatuses.administered ||
      medication.status === MedicationOrderStatuses['administered-partly'];

const diagnosisText = (diagnoses: FlowsheetDiagnosis[]): string =>
  diagnoses.map((d) => [d.code, d.display].filter(Boolean).join(' — ')).join('; ');

export const buildThyroidFlowsheet = (data: FlowsheetData): FlowsheetVisit[] => {
  const columns = conditionColumns(data, VITAL_KEYS);
  columns.addLabs(LAB_ROWS);

  Object.entries(data.diagnoses ?? {}).forEach(([encounterId, diagnoses]) => {
    const thyroid = diagnoses.filter((d) => THYROID_ICD10_PREFIXES.some((prefix) => d.code.startsWith(prefix)));
    if (thyroid.length === 0) return;
    // A follow-up has no appointment start, so a diagnosis-only column is dated by the encounter.
    const encounter = data.encounters.find((e) => e.id === encounterId);
    const visit = columns.columnFor(encounterId, encounter?.period?.start);
    if (!visit) return;
    columns.addReading(visit, 'thyroidDiagnosis', { time: visit.start, value: diagnosisText(thyroid) });
  });

  Object.entries(data.medications ?? {}).forEach(([encounterId, medications]) => {
    const drugs = medications.filter((m) => THYROID_MEDICATION.test(m.name) && prescribedOrGiven(m));
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
