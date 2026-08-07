import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle } from 'fhir/r4b';
import { BillingTag, CLAIM_TAG_SYSTEM, SYSTEM_MANAGED_TAGS } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
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

  // System-managed tags are always reported, even before their Basic definitions exist (e.g. Hold
  // before any rules List has been saved). They get synthetic entries with no id/updatedAt — but
  // real usage counts, since claims can carry a system tag the moment the system applies it.
  const storedNames = basics.map((b) => b.code?.text).filter((name): name is string => !!name);
  const unstoredSystemTags = SYSTEM_MANAGED_TAGS.filter((def) => !storedNames.includes(def.name));

  const usageCounts = await getTagUsageCounts(oystehr, [
    ...new Set(storedNames),
    ...unstoredSystemTags.map((def) => def.name),
  ]);

  const tags: BillingTag[] = [
    ...basics.map((b) => {
      const name = b.code?.text ?? '';
      const systemDef = SYSTEM_MANAGED_TAGS.find((def) => def.name === name);
      return {
        id: b.id ?? '',
        name,
        description:
          b.extension?.find((e) => e.url === TAG_DESCRIPTION_URL)?.valueString ?? systemDef?.description ?? '',
        usage: usageCounts.get(name) ?? 0,
        updatedAt: b.meta?.lastUpdated ?? '',
        isSystemTag: isSystemTag(b),
      };
    }),
    ...unstoredSystemTags.map((def) => ({
      id: '',
      name: def.name,
      description: def.description,
      usage: usageCounts.get(def.name) ?? 0,
      updatedAt: '',
      isSystemTag: true,
    })),
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
