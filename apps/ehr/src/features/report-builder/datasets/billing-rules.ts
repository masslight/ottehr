import {
  AdHocBillingRulesOutput,
  BILLING_RULES_DATASET_ID,
  BILLING_RULES_DOMAIN_FIELDS,
  BILLING_RULES_INTERNAL_FIELDS,
  BILLING_RULES_LAYERS,
  BillingRulesBaseRowSchema,
} from 'utils/lib/types/adhoc/datasets/billing-rules';
import { layerOptions } from 'utils/lib/types/adhoc/datasets/dataset';
import { AdHocRow } from 'utils/lib/types/adhoc/datasets/llm-schema';
import { ADHOC_BILLING_DATASET_ZAMBDA_ID } from '../../../api/api';
import { ADHOC_QUERY_STALE_MS, runAdHocReport } from '../query/dataset-query';
import { buildLlmDatasetSchema } from './schema';
import { AdHocDataset, FetchContext } from './types';

const LABEL = 'Billing rules (billing app)';

const DESCRIPTION =
  'One row per billing rules-engine rule as configured now (the date range does not apply): engine, order, ' +
  'enabled, the claim fields its conditions test (incl. service-line conditions) and what it does. Who created ' +
  'or changed a rule is not recorded.';

async function fetchAdHocBillingRules({ oystehrZambda, queryClient, dateRange }: FetchContext): Promise<AdHocRow[]> {
  const result = await queryClient.fetchQuery({
    // Rules ignore the date range, so a range change reuses the cached rows.
    queryKey: ['adhoc-billing-rules'],
    queryFn: () =>
      runAdHocReport<AdHocBillingRulesOutput>(
        oystehrZambda,
        { datasetId: BILLING_RULES_DATASET_ID, dateRange, options: {} },
        ADHOC_BILLING_DATASET_ZAMBDA_ID
      ),
    staleTime: ADHOC_QUERY_STALE_MS,
  });

  return result.rows;
}

export const billingRulesDataset: AdHocDataset = {
  id: BILLING_RULES_DATASET_ID,
  label: LABEL,
  description: DESCRIPTION,
  options: layerOptions(BILLING_RULES_LAYERS),
  layers: BILLING_RULES_LAYERS,
  baseSchema: BillingRulesBaseRowSchema,
  internalFields: BILLING_RULES_INTERNAL_FIELDS,
  fetch: fetchAdHocBillingRules,
  buildSchema: (rows, options) =>
    buildLlmDatasetSchema({
      datasetId: BILLING_RULES_DATASET_ID,
      label: LABEL,
      description: DESCRIPTION,
      rows,
      base: BillingRulesBaseRowSchema,
      layers: BILLING_RULES_LAYERS,
      selected: options ?? {},
      internalFields: BILLING_RULES_INTERNAL_FIELDS,
      domainFields: BILLING_RULES_DOMAIN_FIELDS,
    }),
};
