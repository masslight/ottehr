import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic, Bundle } from 'fhir/r4b';
import { BillingTag } from 'utils/lib/types/data/billing/billing.types';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { ZambdaInput } from '../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { createBillingClient, searchTagBasics, TAG_DESCRIPTION_URL } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-tags';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createBillingClient(m2mToken, input.secrets);

  const response = await performEffect(oystehr);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr): Promise<{ tags: BillingTag[] }> {
  const basics = await searchTagBasics(oystehr);
  const usageCounts = await getTagUsageCounts(oystehr, basics);

  const tags: BillingTag[] = basics.map((b) => {
    const name = b.code?.text ?? '';
    return {
      id: b.id ?? '',
      name,
      description: b.extension?.find((e) => e.url === TAG_DESCRIPTION_URL)?.valueString ?? '',
      usage: usageCounts.get(name) ?? 0,
      updatedAt: b.meta?.lastUpdated ?? '',
    };
  });

  return { tags };
}

// Count-only search per tag (_count=0 + _total=accurate) reads Bundle.total without fetching claims.
async function getTagUsageCounts(oystehr: Oystehr, tags: Basic[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const tagNames = tags.map((t) => t.code?.text).filter(Boolean) as string[];
  if (tagNames.length === 0) return counts;

  const requests: BatchInputGetRequest[] = tagNames.map((name) => ({
    method: 'GET',
    url: `/Claim?_tag=${encodeURIComponent(`${CLAIM_TAG_SYSTEM}|${name}`)}&_total=accurate&_count=0`,
  }));

  const batchResult = await oystehr.fhir.batch<Bundle>({ requests });

  (batchResult.entry ?? []).forEach((entry, i) => {
    counts.set(tagNames[i], entry.resource?.total ?? 0);
  });

  return counts;
}
