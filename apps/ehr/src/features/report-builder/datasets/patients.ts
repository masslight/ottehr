import { layerOptions } from 'utils/lib/types/adhoc/datasets/dataset';
import {
  AdHocPatientRow,
  AdHocPatientsOutput,
  PATIENT_DOMAIN_FIELDS,
  PATIENT_INTERNAL_FIELDS,
  PATIENT_LAYERS,
  PatientBaseRowSchema,
} from 'utils/lib/types/adhoc/datasets/patients';
import { AdHocLayer } from 'utils/lib/types/adhoc/query/layers';
import { ADHOC_QUERY_STALE_MS, runAdHocReport, toLocalYmd } from '../query/dataset-query';
import { buildLlmDatasetSchema } from './schema';
import { AdHocDataset, AdHocRow, FetchContext } from './types';

export const ADHOC_PATIENTS_OPTIONS: AdHocLayer[] = layerOptions(PATIENT_LAYERS);

async function fetchAdHocPatients({
  oystehrZambda,
  queryClient,
  dateRange,
  options,
}: FetchContext): Promise<AdHocRow[]> {
  const opts = options ?? {};

  const result = await queryClient.fetchQuery({
    queryKey: ['adhoc-patients', dateRange, opts],
    queryFn: () =>
      runAdHocReport<AdHocPatientsOutput>(oystehrZambda, {
        datasetId: 'patients',
        dateRange,
        options: opts,
      }),
    staleTime: ADHOC_QUERY_STALE_MS,
  });

  return result.patients.map(
    (row): AdHocPatientRow => ({
      ...row,
      firstVisitDate: toLocalYmd(row.firstVisitDate),
      lastVisitDate: toLocalYmd(row.lastVisitDate),
    })
  );
}

export const patientsDataset: AdHocDataset = {
  id: 'patients',
  label: 'Patients',
  description:
    'One row per patient seen in the date range, with demographics and a summary of their visits; ' +
    'optional allergy, problem-list, and current-medication layers.',
  options: ADHOC_PATIENTS_OPTIONS,
  layers: PATIENT_LAYERS,
  baseSchema: PatientBaseRowSchema,
  internalFields: PATIENT_INTERNAL_FIELDS,
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
