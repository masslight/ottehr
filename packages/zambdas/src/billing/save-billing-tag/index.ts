import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic, Claim } from 'fhir/r4b';
import { getPatchBinary, INVALID_INPUT_ERROR } from 'utils';
import { checkOrCreateM2MClientToken, fetchAllPages, wrapHandler, ZambdaInput } from '../../shared';
import {
  CLAIM_TAG_SYSTEM,
  createBillingClient,
  fetchById,
  isSystemTag,
  TAG_CODE_SYSTEM,
  TAG_DESCRIPTION_URL,
} from '../shared';
import { SaveBillingTagParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'save-billing-tag';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const existing = await complexValidation(oystehr, params);
  const response = await performEffect(oystehr, params, existing);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// When updating, load the tag being edited and confirm it exists. No-op for create.
async function complexValidation(oystehr: Oystehr, params: SaveBillingTagParams): Promise<Basic | undefined> {
  if (!params.tagId) return undefined;
  const tag = await fetchById<Basic>(oystehr, 'Basic', params.tagId);
  if (isSystemTag(tag)) {
    throw INVALID_INPUT_ERROR('Cannot edit system-level tags');
  }
  return tag;
}

async function performEffect(
  oystehr: Oystehr,
  params: SaveBillingTagParams,
  existing: Basic | undefined
): Promise<{ id: string | undefined }> {
  if (existing) {
    const oldName = existing.code?.text ?? '';
    const otherExts = (existing.extension ?? []).filter((e) => e.url !== TAG_DESCRIPTION_URL);
    const updatedExts = params.description
      ? [...otherExts, { url: TAG_DESCRIPTION_URL, valueString: params.description }]
      : otherExts;

    await oystehr.fhir.patch({
      resourceType: 'Basic',
      id: existing.id!,
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

    return { id: existing.id };
  }

  const tag: Basic = {
    resourceType: 'Basic',
    code: { text: params.name, coding: [{ system: TAG_CODE_SYSTEM, code: 'tag' }] },
    extension: params.description ? [{ url: TAG_DESCRIPTION_URL, valueString: params.description }] : undefined,
  };
  const created = await oystehr.fhir.create<Basic>(tag);
  return { id: created.id };
}

// Fetch all claims with the old tag, then rewrite their meta.tag via FHIR Batch requests
async function rewriteClaimTags(oystehr: Oystehr, oldName: string, newName: string): Promise<string[]> {
  const allClaims = await fetchAllTaggedClaims(oystehr, oldName);
  const failedIds: string[] = [];
  const BATCH_SIZE = 25;

  for (let i = 0; i < allClaims.length; i += BATCH_SIZE) {
    const chunk = allClaims.slice(i, i + BATCH_SIZE);
    const requests = chunk.map((claim) => {
      const updatedTags = (claim.meta?.tag ?? []).map((t) =>
        t.system === CLAIM_TAG_SYSTEM && t.code === oldName ? { ...t, code: newName } : t
      );
      return getPatchBinary({
        resourceType: 'Claim',
        resourceId: claim.id!,
        patchOperations: [{ op: 'add', path: '/meta/tag', value: updatedTags }],
        ifMatch: claim.meta?.versionId ? `W/"${claim.meta.versionId}"` : undefined,
      });
    });

    const result = await oystehr.fhir.batch({ requests });
    (result.entry ?? []).forEach((entry, j) => {
      if (entry.response?.outcome?.id !== 'ok') failedIds.push(chunk[j].id ?? 'unknown');
    });
  }
  return failedIds;
}

async function fetchAllTaggedClaims(oystehr: Oystehr, tagName: string): Promise<Claim[]> {
  const allClaims: Claim[] = [];

  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        { name: '_tag', value: `${CLAIM_TAG_SYSTEM}|${tagName}` },
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });
    allClaims.push(...bundle.unbundle());
    return bundle;
  }, 100);

  return allClaims;
}
