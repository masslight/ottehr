import { layerOptions } from 'utils/lib/types/adhoc/datasets/dataset';
import { AdHocRow } from 'utils/lib/types/adhoc/datasets/llm-schema';
import {
  AdHocReferralsOutput,
  REFERRAL_DOMAIN_FIELDS,
  REFERRAL_INTERNAL_FIELDS,
  REFERRAL_LAYERS,
  ReferralBaseRowSchema,
} from 'utils/lib/types/adhoc/datasets/referrals';
import { AdHocLayer } from 'utils/lib/types/adhoc/query/layers';
import { ADHOC_QUERY_STALE_MS, runAdHocReport } from '../query/dataset-query';
import { buildLlmDatasetSchema } from './schema';
import { AdHocDataset, FetchContext } from './types';

export const ADHOC_REFERRALS_OPTIONS: AdHocLayer[] = layerOptions(REFERRAL_LAYERS);

async function fetchAdHocReferrals({
  oystehrZambda,
  queryClient,
  dateRange,
  options,
}: FetchContext): Promise<AdHocRow[]> {
  const opts = options ?? {};

  const result = await queryClient.fetchQuery({
    queryKey: ['adhoc-referrals', dateRange, opts],
    queryFn: () =>
      runAdHocReport<AdHocReferralsOutput>(oystehrZambda, {
        datasetId: 'referrals',
        dateRange,
        options: opts,
      }),
    staleTime: ADHOC_QUERY_STALE_MS,
  });

  return result.referrals;
}

export const referralsDataset: AdHocDataset = {
  id: 'referrals',
  label: 'Referrals',
  description:
    'One row per referral created in the date range: specialty, recipient, referring provider, location, status ' +
    'and the sent / response / closed dates.',
  options: ADHOC_REFERRALS_OPTIONS,
  layers: REFERRAL_LAYERS,
  baseSchema: ReferralBaseRowSchema,
  internalFields: REFERRAL_INTERNAL_FIELDS,
  fetch: fetchAdHocReferrals,
  buildSchema: (rows, options) => {
    const opts = options ?? {};
    return buildLlmDatasetSchema({
      datasetId: 'referrals',
      label: 'Referrals',
      description:
        'One row per referral — specialty, recipient, referring provider, location, status, dates, and the ' +
        'follow-up task layer when enabled.',
      rows,
      base: ReferralBaseRowSchema,
      layers: REFERRAL_LAYERS,
      selected: opts,
      internalFields: REFERRAL_INTERNAL_FIELDS,
      domainFields: REFERRAL_DOMAIN_FIELDS,
    });
  },
};
