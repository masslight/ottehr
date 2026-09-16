import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle } from 'fhir/r4b';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { BillingTag } from 'utils/lib/types/data/billing/billing.types';
import { SYSTEM_MANAGED_TAGS } from 'utils/lib/types/data/billing/system-tags';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient, isSystemTag, searchTagBasics, TAG_DESCRIPTION_URL } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-tags';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createBillingClient(m2mToken, input.secrets);

  const response = await performEffect(oystehr);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(oystehr: Oystehr): Promise<{ tags: BillingTag[] }> {
  const basics = await searchTagBasics(oystehr);

  // System-managed tags are reported from SYSTEM_MANAGED_TAGS, never from storage — they are
  // defined in code and no longer seeded as Basics. A stored definition carrying a system-managed
  // name is a leftover from the releases that did seed them (and raced itself into duplicates), so
  // it is dropped here rather than listed. Usage counts are real either way, since a claim carries
  // a system tag the moment the system applies it. Listing them first keeps them grouped, since
  // they have no lastUpdated to sort by.
  const userTagBasics = basics.filter((b) => !isSystemTag(b));
  const userTagNames = userTagBasics.map((b) => b.code?.text).filter((name): name is string => !!name);

  const usageCounts = await getTagUsageCounts(oystehr, [
    ...SYSTEM_MANAGED_TAGS.map((def) => def.name),
    ...new Set(userTagNames),
  ]);

  const tags: BillingTag[] = [
    ...SYSTEM_MANAGED_TAGS.map((def) => ({
      id: '',
      name: def.name,
      description: def.description,
      usage: usageCounts.get(def.name) ?? 0,
      updatedAt: '',
      isSystemTag: true,
    })),
    ...userTagBasics.map((b) => {
      const name = b.code?.text ?? '';
      return {
        id: b.id ?? '',
        name,
        description: b.extension?.find((e) => e.url === TAG_DESCRIPTION_URL)?.valueString ?? '',
        usage: usageCounts.get(name) ?? 0,
        updatedAt: b.meta?.lastUpdated ?? '',
        isSystemTag: false,
      };
    }),
  ];

  return { tags };
}

// Count-only search per tag (_count=0 + _total=accurate) reads Bundle.total without fetching claims.
async function getTagUsageCounts(oystehr: Oystehr, tagNames: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
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
