import { layerOptions } from 'utils/lib/types/adhoc/datasets/dataset';
import { AdHocRow } from 'utils/lib/types/adhoc/datasets/llm-schema';
import {
  AdHocMedicationInventoryOutput,
  AdHocMedicationInventoryRow,
  MEDICATION_INVENTORY_DATASET_ID,
  MEDICATION_INVENTORY_DOMAIN_FIELDS,
  MEDICATION_INVENTORY_INTERNAL_FIELDS,
  MEDICATION_INVENTORY_LAYERS,
  MedicationInventoryBaseRowSchema,
} from 'utils/lib/types/adhoc/datasets/medication-inventory';
import { ADHOC_QUERY_STALE_MS, runAdHocReport, toLocalYmd } from '../query/dataset-query';
import { buildLlmDatasetSchema } from './schema';
import { AdHocDataset, FetchContext } from './types';

const LABEL = 'Medication inventory';

const DESCRIPTION =
  'One row per in-house medication stock entry in the date range: shipments received, medications given at visits ' +
  '(with any wasted dose), reversals, adjustments with a reason and shelf counts, each with its clinic, lot and ' +
  'quantity. Waste by reason, usage, received stock and expiring stock by clinic and period.';

async function fetchAdHocMedicationInventory({
  oystehrZambda,
  queryClient,
  dateRange,
}: FetchContext): Promise<AdHocRow[]> {
  const result = await queryClient.fetchQuery({
    queryKey: ['adhoc-medication-inventory', dateRange],
    queryFn: () =>
      runAdHocReport<AdHocMedicationInventoryOutput>(oystehrZambda, {
        datasetId: MEDICATION_INVENTORY_DATASET_ID,
        dateRange,
        options: {},
      }),
    staleTime: ADHOC_QUERY_STALE_MS,
  });

  return result.rows.map((row): AdHocMedicationInventoryRow => ({ ...row, date: toLocalYmd(row.dateTime) }));
}

export const medicationInventoryDataset: AdHocDataset = {
  id: MEDICATION_INVENTORY_DATASET_ID,
  label: LABEL,
  description: DESCRIPTION,
  options: layerOptions(MEDICATION_INVENTORY_LAYERS),
  layers: MEDICATION_INVENTORY_LAYERS,
  baseSchema: MedicationInventoryBaseRowSchema,
  internalFields: MEDICATION_INVENTORY_INTERNAL_FIELDS,
  fetch: fetchAdHocMedicationInventory,
  buildSchema: (rows, options) =>
    buildLlmDatasetSchema({
      datasetId: MEDICATION_INVENTORY_DATASET_ID,
      label: LABEL,
      description: DESCRIPTION,
      rows,
      base: MedicationInventoryBaseRowSchema,
      layers: MEDICATION_INVENTORY_LAYERS,
      selected: options ?? {},
      internalFields: MEDICATION_INVENTORY_INTERNAL_FIELDS,
      domainFields: MEDICATION_INVENTORY_DOMAIN_FIELDS,
    }),
};
