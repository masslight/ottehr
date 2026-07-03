import {
  AdHocPatientRow,
  layerIncludeFlags,
  layerOptions,
  PATIENT_DOMAIN_FIELDS,
  PATIENT_INTERNAL_FIELDS,
  PATIENT_LAYERS,
  PatientBaseRowSchema,
} from 'utils';
import { getAdHocPatients } from '../../../api/api';
import { ADHOC_QUERY_STALE_MS, fetchBatchedRange, toLocalYmd } from '../query/batching';
import { buildLlmDatasetSchema } from './schema';
import { AdHocDataset, AdHocDatasetOption, AdHocRow, FetchContext } from './types';

// One row per patient seen in the date range — patient-centric counterpart to the Encounters
// dataset. Demographics + visit summary come back on every fetch; patient-bound clinical layers are
// opt-in checkboxes, derived from the Zod layer map (id/label/description).
export const ADHOC_PATIENTS_OPTIONS: AdHocDatasetOption[] = layerOptions(PATIENT_LAYERS);

// Merge partial per-patient rows spanning date-batches into one. Visit summary is additive;
// patient-attribute arrays (allergies etc.) are identical across batches, so union/dedupe is safe.
function mergePatientRows(rows: AdHocPatientRow[]): AdHocPatientRow[] {
  const byId = new Map<string, AdHocPatientRow>();
  const uniq = <T extends string>(a: T[] = [], b: T[] = []): T[] => Array.from(new Set([...a, ...b])).sort();
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
    if (row.lastVisitDate && (!existing.lastVisitDate || row.lastVisitDate >= existing.lastVisitDate)) {
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

async function fetchAdHocPatients({
  oystehrZambda,
  queryClient,
  dateRange,
  options,
}: FetchContext): Promise<AdHocRow[]> {
  const opts = options ?? {};
  const flags = layerIncludeFlags(PATIENT_LAYERS, opts);

  // Localize first/lastVisitDate to viewer-local day BEFORE the merge, so mergePatientRows keeps
  // comparing day-level yyyy-MM-dd strings. Then merge partial per-patient rows across batches.
  const rows = await fetchBatchedRange(
    dateRange,
    (range) =>
      queryClient
        .fetchQuery({
          queryKey: ['adhoc-patients', range, flags],
          queryFn: () => getAdHocPatients(oystehrZambda, { dateRange: range, ...flags }),
          staleTime: ADHOC_QUERY_STALE_MS,
        })
        .then((r) =>
          r.patients.map(
            (row): AdHocPatientRow => ({
              ...row,
              firstVisitDate: toLocalYmd(row.firstVisitDate),
              lastVisitDate: toLocalYmd(row.lastVisitDate),
            })
          )
        ),
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
    return buildLlmDatasetSchema({
      datasetId: 'patients',
      label: 'Patients',
      description: 'One row per patient — demographics, visit summary, and any enabled clinical layers.',
      rows,
      base: PatientBaseRowSchema,
      layers: PATIENT_LAYERS,
      selected: opts,
      internalFields: PATIENT_INTERNAL_FIELDS,
      domainFields: PATIENT_DOMAIN_FIELDS,
    });
  },
};
