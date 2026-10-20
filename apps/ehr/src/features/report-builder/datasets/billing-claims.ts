import {
  AdHocBillingClaimsOutput,
  AdHocBillingClaimsRow,
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
import { ADHOC_QUERY_STALE_MS, runAdHocReport, toLocalYmd } from '../query/dataset-query';
import { buildLlmDatasetSchema } from './schema';
import { AdHocDataset, FetchContext } from './types';

export const ADHOC_BILLING_CLAIMS_OPTIONS: AdHocLayer[] = layerOptions(BILLING_CLAIMS_LAYERS);

const LABEL = 'Claims (billing app)';

const DESCRIPTION =
  'One row per billing-app claim, by date of service — claim status and AR stage, payer, billed / allowed / ' +
  'insurance paid / patient responsibility / patient paid / write-offs / balance, and optionally the claim codes, ' +
  'write-offs, ERA remittances (adjustment / denial codes) and AR milestone dates. Patient payments taken at the ' +
  'visit, eligibility and fee-schedule pricing are in "Visit payments & charges (EHR)".';

function toLocalDates(row: AdHocBillingClaimsRow): AdHocBillingClaimsRow {
  const out: AdHocBillingClaimsRow = { ...row };
  if (row.lastRemitDate !== undefined) out.lastRemitDate = toLocalYmd(row.lastRemitDate);
  if (row.insuranceFinalizedDate !== undefined) out.insuranceFinalizedDate = toLocalYmd(row.insuranceFinalizedDate);
  if (row.enteredPatientArDate !== undefined) out.enteredPatientArDate = toLocalYmd(row.enteredPatientArDate);
  if (row.remits) out.remits = row.remits.map((remit) => ({ ...remit, date: toLocalYmd(remit.date) }));

  if (row.remitAdjustments) {
    out.remitAdjustments = row.remitAdjustments.map((adjustment) => ({
      ...adjustment,
      remitDate: toLocalYmd(adjustment.remitDate),
    }));
  }

  if (row.writeOffs)
    out.writeOffs = row.writeOffs.map((writeOff) => ({ ...writeOff, date: toLocalYmd(writeOff.date) }));

  return out;
}

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

  return result.rows.map(toLocalDates);
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
