import {
  AdHocBillingClaimsOutput,
  BILLING_CLAIMS_DATASET_ID,
  BILLING_CLAIMS_DOMAIN_FIELDS,
  BILLING_CLAIMS_INTERNAL_FIELDS,
  BILLING_CLAIMS_LAYERS,
  BillingClaimsBaseRowSchema,
} from 'utils/lib/types/adhoc/datasets/billing-claims';
import { layerOptions } from 'utils/lib/types/adhoc/datasets/dataset';
import { AdHocRow } from 'utils/lib/types/adhoc/datasets/llm-schema';
import { AdHocLayer } from 'utils/lib/types/adhoc/query/layers';
import { ADHOC_BILLING_DATASET_ZAMBDA_ID } from '../../../api/api';
import { ADHOC_QUERY_STALE_MS, runAdHocReport } from '../query/dataset-query';
import { buildLlmDatasetSchema } from './schema';
import { AdHocDataset, FetchContext } from './types';

export const ADHOC_BILLING_CLAIMS_OPTIONS: AdHocLayer[] = layerOptions(BILLING_CLAIMS_LAYERS);

const LABEL = 'Claims (billing app)';

const DESCRIPTION =
  'One row per billing-app claim, by date of service — claim status and AR stage, payer, billed / allowed / ' +
  'insurance paid / patient responsibility / patient paid / write-offs / balance, and optionally the claim codes, ' +
  'write-offs, every patient payment and refund (including those recorded in the billing app), ERA remittances ' +
  '(adjustment / denial codes), insurance checks, the insurances on the claim, provider / facility / institutional ' +
  'details, and the claim history (status changes, submissions, acknowledgments). Eligibility and fee-schedule ' +
  'pricing are in "Visit payments & charges (EHR)".';

async function fetchAdHocBillingClaims({
  oystehrZambda,
  queryClient,
  dateRange,
  options,
}: FetchContext): Promise<AdHocRow[]> {
  const opts = options ?? {};

  const result = await queryClient.fetchQuery({
    queryKey: ['adhoc-billing-claims', dateRange, opts],
    queryFn: () =>
      runAdHocReport<AdHocBillingClaimsOutput>(
        oystehrZambda,
        { datasetId: BILLING_CLAIMS_DATASET_ID, dateRange, options: opts },
        ADHOC_BILLING_DATASET_ZAMBDA_ID
      ),
    staleTime: ADHOC_QUERY_STALE_MS,
  });

  // Dates arrive as yyyy-MM-dd days, already in the zone the report range is drawn in.
  return result.rows;
}

export const billingClaimsDataset: AdHocDataset = {
  id: BILLING_CLAIMS_DATASET_ID,
  label: LABEL,
  description: DESCRIPTION,
  options: ADHOC_BILLING_CLAIMS_OPTIONS,
  layers: BILLING_CLAIMS_LAYERS,
  baseSchema: BillingClaimsBaseRowSchema,
  internalFields: BILLING_CLAIMS_INTERNAL_FIELDS,
  fetch: fetchAdHocBillingClaims,
  buildSchema: (rows, options) =>
    buildLlmDatasetSchema({
      datasetId: BILLING_CLAIMS_DATASET_ID,
      label: LABEL,
      description: DESCRIPTION,
      rows,
      base: BillingClaimsBaseRowSchema,
      layers: BILLING_CLAIMS_LAYERS,
      selected: options ?? {},
      internalFields: BILLING_CLAIMS_INTERNAL_FIELDS,
      domainFields: BILLING_CLAIMS_DOMAIN_FIELDS,
    }),
};
