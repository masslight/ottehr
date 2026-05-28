import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic, Claim } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { CLAIM_TAG_SYSTEM, createBillingClient, TAG_CODE_SYSTEM, TAG_DESCRIPTION_URL } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'save-billing-tag';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  if (params.tagId) {
    const bundle = await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [{ name: '_id', value: params.tagId }],
    });
    const existing = bundle.unbundle()[0];
    if (!existing) throw FHIR_RESOURCE_NOT_FOUND('Basic');

    const oldName = existing.code?.text ?? '';
    const otherExts = (existing.extension ?? []).filter((e) => e.url !== TAG_DESCRIPTION_URL);
    const updatedExts = params.description
      ? [...otherExts, { url: TAG_DESCRIPTION_URL, valueString: params.description }]
      : otherExts;

    await oystehr.fhir.patch({
      resourceType: 'Basic',
      id: params.tagId,
      operations: [
        { op: 'add', path: '/code/text', value: params.name },
        { op: 'add', path: '/extension', value: updatedExts },
      ],
    });

    // When the name changed, rewrite meta.tag on all claims that reference the old name
    if (oldName && oldName !== params.name) {
      const failedIds = await rewriteClaimTags(oystehr, oldName, params.name);
      if (failedIds.length) {
        throw INVALID_INPUT_ERROR(
          `Tag renamed but ${failedIds.length} claim(s) failed to update: ${failedIds.slice(0, 10).join(', ')}`
        );
      }
    }

    return { statusCode: 200, body: JSON.stringify({ id: params.tagId }) };
  }

  const tag: Basic = {
    resourceType: 'Basic',
    code: { text: params.name, coding: [{ system: TAG_CODE_SYSTEM, code: 'tag' }] },
    extension: params.description ? [{ url: TAG_DESCRIPTION_URL, valueString: params.description }] : undefined,
  };
  const created = await oystehr.fhir.create<Basic>(tag);
  return { statusCode: 200, body: JSON.stringify({ id: created.id }) };
});

// Fetch all claims with the old tag using offset pagination, then batch-patch in groups
async function rewriteClaimTags(oystehr: Oystehr, oldName: string, newName: string): Promise<string[]> {
  const allClaims = await fetchAllTaggedClaims(oystehr, oldName);
  const failedIds: string[] = [];
  const BATCH_SIZE = 25;

  for (let i = 0; i < allClaims.length; i += BATCH_SIZE) {
    const batch = allClaims.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((claim) => {
        const updatedTags = (claim.meta?.tag ?? []).map((t) =>
          t.system === CLAIM_TAG_SYSTEM && t.code === oldName ? { ...t, code: newName } : t
        );
        return oystehr.fhir.patch(
          { resourceType: 'Claim', id: claim.id!, operations: [{ op: 'add', path: '/meta/tag', value: updatedTags }] },
          { optimisticLockingVersionId: claim.meta?.versionId }
        );
      })
    );
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'rejected') failedIds.push(batch[j].id ?? 'unknown');
    }
  }
  return failedIds;
}

async function fetchAllTaggedClaims(oystehr: Oystehr, tagName: string): Promise<Claim[]> {
  const PAGE_SIZE = 100;
  const allClaims: Claim[] = [];
  let offset = 0;

  for (;;) {
    const bundle = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        { name: '_tag', value: `${CLAIM_TAG_SYSTEM}|${tagName}` },
        { name: '_count', value: String(PAGE_SIZE) },
        { name: '_offset', value: String(offset) },
      ],
    });
    const page = bundle.unbundle();
    allClaims.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return allClaims;
}
