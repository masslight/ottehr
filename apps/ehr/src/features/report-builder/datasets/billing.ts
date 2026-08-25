import {
  AdHocBillingOutput,
  AdHocBillingRow,
  BILLING_DOMAIN_FIELDS,
  BILLING_INTERNAL_FIELDS,
  BILLING_LAYERS,
  BillingBaseRowSchema,
} from 'utils/lib/types/adhoc/datasets/billing';
import { layerOptions } from 'utils/lib/types/adhoc/datasets/dataset';
import { AdHocLayer } from 'utils/lib/types/adhoc/query/layers';
import { ADHOC_QUERY_STALE_MS, runAdHocReport, toLocalYmd } from '../query/dataset-query';
import { buildLlmDatasetSchema } from './schema';
import { AdHocDataset, AdHocRow, FetchContext } from './types';

export const ADHOC_BILLING_OPTIONS: AdHocLayer[] = layerOptions(BILLING_LAYERS);

async function fetchAdHocBilling({
  oystehrZambda,
  queryClient,
  dateRange,
  options,
}: FetchContext): Promise<AdHocRow[]> {
  const opts = options ?? {};

  const result = await queryClient.fetchQuery({
    queryKey: ['adhoc-billing', dateRange, opts],
    queryFn: () =>
      runAdHocReport<AdHocBillingOutput>(oystehrZambda, {
        datasetId: 'billing',
        dateRange,
        options: opts,
      }),
    staleTime: ADHOC_QUERY_STALE_MS,
  });

  return result.rows.map(
    (row): AdHocBillingRow => ({
      ...row,
      date: toLocalYmd(row.date),
      lastPaymentDate: row.lastPaymentDate == null ? row.lastPaymentDate : toLocalYmd(row.lastPaymentDate),
    })
  );
}

export const billingDataset: AdHocDataset = {
  id: 'billing',
  label: 'Billing',
  description:
    'One row per encounter, focused on billing & revenue; optional patient-payment, insurance-coverage, ' +
    'charges/fee-schedule, and billing-code layers.',
  options: ADHOC_BILLING_OPTIONS,
  layers: BILLING_LAYERS,
  baseSchema: BillingBaseRowSchema,
  internalFields: BILLING_INTERNAL_FIELDS,
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
