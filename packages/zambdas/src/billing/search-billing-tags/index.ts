import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { BillingTag } from 'utils/lib/types/data/billing/billing.types';
import { SYSTEM_MANAGED_TAGS } from 'utils/lib/types/data/billing/system-tags';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { countClaimsByTag, createBillingClient, isSystemTag, searchTagBasics, TAG_DESCRIPTION_URL } from '../shared';

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

  // System-managed tags are listed first because they have no lastUpdated to sort by.
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

async function getTagUsageCounts(oystehr: Oystehr, tagNames: string[]): Promise<Map<string, number>> {
  const counts = await countClaimsByTag(oystehr, tagNames);

  const unreadable = [...counts.entries()].filter(([, count]) => count === undefined).map(([name]) => name);
  if (unreadable.length > 0) {
    console.warn(`usage count unavailable, reporting 0 for: ${unreadable.join(', ')}`);
  }

  return new Map([...counts.entries()].map(([name, count]) => [name, count ?? 0]));
}
