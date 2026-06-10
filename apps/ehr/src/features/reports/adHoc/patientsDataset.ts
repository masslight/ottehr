import { AdHocPatientRow } from 'utils';
import { getAdHocPatients } from '../../../api/api';
import { availableLayersFor, fetchBatchedRange } from './datasetHelpers';
import { buildSchema, FieldDef } from './schema';
import { AdHocDataset, AdHocDatasetOption, AdHocRow, FetchContext } from './types';

// One row per PATIENT seen in the date range — the patient-centric counterpart to the Encounters
// dataset. Demographics + a visit summary come back on every fetch; patient-bound clinical layers
// (allergies / problem list / current medications) are opt-in checkboxes.
export const ADHOC_PATIENTS_OPTIONS: AdHocDatasetOption[] = [
  {
    id: 'allergies',
    label: 'Allergies',
    description: "The patient's known allergy list.",
    default: false,
  },
  {
    id: 'problems',
    label: 'Problem list',
    description: 'Chronic conditions / problem list (ICD-10), distinct from per-visit diagnoses.',
    default: false,
  },
  {
    id: 'medications',
    label: 'Current medications',
    description: "The patient's current/home medication list.",
    default: false,
  },
  {
    id: 'surgicalHistory',
    label: 'Surgical history',
    description: "The patient's past surgical procedures.",
    default: false,
  },
  {
    id: 'hospitalizations',
    label: 'Hospitalizations',
    description: "The patient's prior hospitalizations.",
    default: false,
  },
];

const BASE_FIELDS: FieldDef[] = [
  {
    name: 'patientId',
    type: 'string',
    description: 'Unique patient id. Link with href="/patient/" + patientId. Use to count UNIQUE patients.',
  },
  { name: 'firstName', type: 'string', description: 'Patient first name.' },
  { name: 'lastName', type: 'string', description: 'Patient last name.' },
  { name: 'patientName', type: 'string', description: 'Patient full name.' },
  { name: 'dateOfBirth', type: 'date', description: 'Patient date of birth (yyyy-MM-dd).' },
  { name: 'age', type: 'number', description: 'Patient age in years (as of today). Null when DOB is missing.' },
  { name: 'sex', type: 'string', description: 'Patient sex/gender label.' },
  { name: 'city', type: 'string', description: 'Patient city.' },
  { name: 'state', type: 'string', description: 'Patient state.' },
  { name: 'zip', type: 'string', description: 'Patient ZIP/postal code.' },
  { name: 'phone', type: 'string', description: 'Patient phone number.' },
  { name: 'email', type: 'string', description: 'Patient email address.' },
  {
    name: 'source',
    type: 'string',
    description: 'How the patient heard about the practice (point of discovery / marketing).',
  },
  {
    name: 'totalVisits',
    type: 'number',
    description: 'Number of visits this patient had WITHIN the selected date range. Sum for total visit volume.',
  },
  { name: 'firstVisitDate', type: 'date', description: 'Earliest visit date in range (yyyy-MM-dd).' },
  { name: 'lastVisitDate', type: 'date', description: 'Most recent visit date in range (yyyy-MM-dd).' },
  { name: 'lastVisitStatus', type: 'string', description: 'Status of the most recent visit in range.' },
  {
    name: 'visitTypes',
    type: 'string[]',
    description: 'Distinct visit types the patient had in range ("In-Person"/"Telemed").',
  },
  { name: 'locations', type: 'string[]', description: 'Distinct clinics the patient visited in range.' },
  { name: 'providers', type: 'string[]', description: 'Distinct attending providers the patient saw in range.' },
  {
    name: 'serviceCategories',
    type: 'string[]',
    description: 'Distinct service lines the patient was seen for in range.',
  },
];

const ALLERGY_FIELDS: FieldDef[] = [
  {
    name: 'allergies',
    type: 'string[]',
    description: "The patient's known allergens (display names). Tally across rows for top allergens / prevalence.",
  },
  { name: 'allergyCount', type: 'number', description: 'Number of charted allergies for the patient. 0 when none.' },
];

const PROBLEM_FIELDS: FieldDef[] = [
  {
    name: 'problems',
    type: 'string[]',
    description:
      "The patient's problem-list / chronic conditions as display names (distinct from per-visit diagnoses). " +
      'Tally for comorbidity prevalence.',
  },
  {
    name: 'problemCodes',
    type: 'string[]',
    description:
      'ICD-10 codes for the problem list (parallel to problems). ICD-10 is HIERARCHICAL — match a family by ' +
      'category PREFIX (code.startsWith("E11") for type-2 diabetes), not a hand-typed full-code list.',
  },
  { name: 'problemCount', type: 'number', description: 'Number of problem-list conditions for the patient.' },
];

const MEDICATION_FIELDS: FieldDef[] = [
  {
    name: 'currentMedications',
    type: 'string[]',
    description: "The patient's current/home medications (display names). Tally for most-common medications.",
  },
  {
    name: 'currentMedicationCount',
    type: 'number',
    description: 'Number of current/home medications for the patient. 0 when none.',
  },
];

const SURGICAL_FIELDS: FieldDef[] = [
  {
    name: 'surgicalHistory',
    type: 'string[]',
    description: "The patient's past surgical procedures (names). Tally for common prior surgeries.",
  },
  { name: 'surgicalHistoryCount', type: 'number', description: 'Number of past surgeries charted for the patient.' },
];

const HOSPITALIZATION_FIELDS: FieldDef[] = [
  {
    name: 'hospitalizations',
    type: 'string[]',
    description: "The patient's prior hospitalization reasons. Tally for common hospitalization causes.",
  },
  {
    name: 'hospitalizationCount',
    type: 'number',
    description: 'Number of prior hospitalizations charted for the patient.',
  },
];

function fieldsFor(options: Record<string, boolean>): FieldDef[] {
  return [
    ...BASE_FIELDS,
    ...(options.allergies ? ALLERGY_FIELDS : []),
    ...(options.problems ? PROBLEM_FIELDS : []),
    ...(options.medications ? MEDICATION_FIELDS : []),
    ...(options.surgicalHistory ? SURGICAL_FIELDS : []),
    ...(options.hospitalizations ? HOSPITALIZATION_FIELDS : []),
  ];
}

// Merge partial per-patient rows that span date-batches into one. Visit summary is additive; the
// patient-attribute arrays (allergies etc.) are identical across batches, so union/dedupe is safe.
function mergePatientRows(rows: AdHocPatientRow[]): AdHocPatientRow[] {
  const byId = new Map<string, AdHocPatientRow>();
  const uniq = (a: string[] = [], b: string[] = []): string[] => Array.from(new Set([...a, ...b])).sort();
  for (const row of rows) {
    const existing = byId.get(row.patientId);
    if (!existing) {
      byId.set(row.patientId, { ...row });
      continue;
    }
    existing.totalVisits += row.totalVisits;
    if (row.firstVisitDate && (!existing.firstVisitDate || row.firstVisitDate < existing.firstVisitDate)) {
      existing.firstVisitDate = row.firstVisitDate;
    }
    if (row.lastVisitDate && row.lastVisitDate >= existing.lastVisitDate) {
      existing.lastVisitDate = row.lastVisitDate;
      existing.lastVisitStatus = row.lastVisitStatus;
    }
    existing.visitTypes = uniq(existing.visitTypes, row.visitTypes);
    existing.locations = uniq(existing.locations, row.locations);
    existing.providers = uniq(existing.providers, row.providers);
    existing.serviceCategories = uniq(existing.serviceCategories, row.serviceCategories);
    if (row.allergies) existing.allergies = uniq(existing.allergies, row.allergies);
    if (row.allergyCount != null) existing.allergyCount = existing.allergies?.length ?? row.allergyCount;
    if (row.problems) existing.problems = uniq(existing.problems, row.problems);
    if (row.problemCodes) existing.problemCodes = uniq(existing.problemCodes, row.problemCodes);
    if (row.problemCount != null) existing.problemCount = existing.problems?.length ?? row.problemCount;
    if (row.currentMedications) existing.currentMedications = uniq(existing.currentMedications, row.currentMedications);
    if (row.currentMedicationCount != null) {
      existing.currentMedicationCount = existing.currentMedications?.length ?? row.currentMedicationCount;
    }
    if (row.surgicalHistory) existing.surgicalHistory = uniq(existing.surgicalHistory, row.surgicalHistory);
    if (row.surgicalHistoryCount != null)
      existing.surgicalHistoryCount = existing.surgicalHistory?.length ?? row.surgicalHistoryCount;
    if (row.hospitalizations) existing.hospitalizations = uniq(existing.hospitalizations, row.hospitalizations);
    if (row.hospitalizationCount != null)
      existing.hospitalizationCount = existing.hospitalizations?.length ?? row.hospitalizationCount;
  }
  return [...byId.values()];
}

async function fetchAdHocPatients({ oystehrZambda, dateRange, options }: FetchContext): Promise<AdHocRow[]> {
  const opts = options ?? {};
  const flags = {
    includeAllergies: !!opts.allergies,
    includeProblems: !!opts.problems,
    includeMedications: !!opts.medications,
    includeSurgicalHistory: !!opts.surgicalHistory,
    includeHospitalizations: !!opts.hospitalizations,
  };
  // Batch long ranges, then MERGE partial per-patient rows (a patient may appear in several batches).
  const rows = await fetchBatchedRange(
    dateRange,
    (range) => getAdHocPatients(oystehrZambda, { dateRange: range, ...flags }).then((r) => r.patients),
    mergePatientRows
  );
  return rows as unknown as AdHocRow[];
}

export const patientsDataset: AdHocDataset = {
  id: 'patients',
  label: 'Patients',
  description:
    'One row per patient seen in the date range, with demographics and a summary of their visits; ' +
    'optional allergy, problem-list, and current-medication layers.',
  options: ADHOC_PATIENTS_OPTIONS,
  fetch: fetchAdHocPatients,
  buildSchema: (rows, options) => {
    const opts = options ?? {};
    return buildSchema(
      rows,
      {
        datasetId: 'patients',
        label: 'Patients',
        description: 'One row per patient — demographics, visit summary, and any enabled clinical layers.',
        availableLayers: availableLayersFor(ADHOC_PATIENTS_OPTIONS, opts),
      },
      fieldsFor(opts)
    );
  },
};
