import {
  AdHocBillingRow,
  BILLING_DOMAIN_FIELDS,
  BILLING_INTERNAL_FIELDS,
  BILLING_LAYERS,
  BillingBaseRowSchema,
  layerIncludeFlags,
  layerOptions,
} from 'utils';
import { getAdHocBilling } from '../../../api/api';
import { ADHOC_QUERY_STALE_MS, dedupeByEncounter, fetchBatchedRange, toLocalYmd } from '../query/batching';
import { buildLlmDatasetSchema } from './schema';
import { AdHocDataset, AdHocDatasetOption, AdHocRow, FetchContext } from './types';

// One row per encounter, billing-focused. Base = visit/patient/location identity; opt-in layers add
// financial/insurance subsets. Checkboxes derive from the Zod layer map (id/label/description).
export const ADHOC_BILLING_OPTIONS: AdHocDatasetOption[] = layerOptions(BILLING_LAYERS);

async function fetchAdHocBilling({
  oystehrZambda,
  queryClient,
  dateRange,
  options,
}: FetchContext): Promise<AdHocRow[]> {
  const opts = options ?? {};
  const flags = layerIncludeFlags(BILLING_LAYERS, opts);

  // Zambda emits date/lastPaymentDate as raw ISO; derive viewer-local yyyy-MM-dd here.
  const rows = await fetchBatchedRange(
    dateRange,
    (range) =>
      queryClient
        .fetchQuery({
          queryKey: ['adhoc-billing', range, flags],
          queryFn: () => getAdHocBilling(oystehrZambda, { dateRange: range, ...flags }),
          staleTime: ADHOC_QUERY_STALE_MS,
        })
        .then((r) =>
          r.rows.map(
            (row): AdHocBillingRow => ({
              ...row,
              date: toLocalYmd(row.date),
              lastPaymentDate: row.lastPaymentDate == null ? row.lastPaymentDate : toLocalYmd(row.lastPaymentDate),
            })
          )
        ),
    dedupeByEncounter
  );

  return rows as unknown as AdHocRow[];
}

export const billingDataset: AdHocDataset = {
  id: 'billing',
  label: 'Billing',
  description:
    'One row per encounter, focused on billing & revenue; optional patient-payment, insurance-coverage, ' +
    'charges/fee-schedule, and billing-code layers.',
  options: ADHOC_BILLING_OPTIONS,
  fetch: fetchAdHocBilling,
  buildSchema: (rows, options) => {
    const opts = options ?? {};
    return buildLlmDatasetSchema({
      datasetId: 'billing',
      label: 'Billing',
      description: 'One row per encounter — visit/patient identity plus any enabled billing layers.',
      rows,
      base: BillingBaseRowSchema,
      layers: BILLING_LAYERS,
      selected: opts,
      internalFields: BILLING_INTERNAL_FIELDS,
      domainFields: BILLING_DOMAIN_FIELDS,
    });
  },
};
