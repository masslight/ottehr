import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic, Claim } from 'fhir/r4b';
import { BillingTag } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { CLAIM_TAG_SYSTEM, createBillingClient, TAG_CODE_SYSTEM, TAG_DESCRIPTION_URL } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-tags';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createBillingClient(m2mToken, input.secrets);

  const response = await performEffect(oystehr);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr): Promise<{ tags: BillingTag[] }> {
  const bundle = await oystehr.fhir.search<Basic>({
    resourceType: 'Basic',
    params: [
      { name: 'code', value: `${TAG_CODE_SYSTEM}|tag` },
      { name: '_sort', value: '-_lastUpdated' },
      { name: '_count', value: '200' },
    ],
  });

  const basics = bundle.unbundle();
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

// Single FHIR search with _tag to count claims per tag, instead of N+1 per-tag queries
async function getTagUsageCounts(oystehr: Oystehr, tags: Basic[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const tagNames = tags.map((t) => t.code?.text).filter(Boolean) as string[];
  if (tagNames.length === 0) return counts;

  // Fetch all tagged claims in one query — _elements: id,meta keeps payload small
  const result = await oystehr.fhir.search<Claim>({
    resourceType: 'Claim',
    params: [
      { name: '_tag', value: tagNames.map((n) => `${CLAIM_TAG_SYSTEM}|${n}`).join(',') },
      { name: '_count', value: '1000' },
      { name: '_elements', value: 'id,meta' },
    ],
  });

  for (const claim of result.unbundle()) {
    for (const tag of claim.meta?.tag ?? []) {
      if (tag.system === CLAIM_TAG_SYSTEM && tag.code) {
        counts.set(tag.code, (counts.get(tag.code) ?? 0) + 1);
      }
    }
  }
  return counts;
}
