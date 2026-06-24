import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim } from 'fhir/r4b';
import { ProvenanceAgent } from 'fhir/r4b';
import {
  CLAIM_STATUS_FIELDS,
  CLAIM_STATUS_FIELDS_BY_KEY,
  ClaimStatusValues,
  claimStatusValuesToTags,
  getClaimStatusValues,
  getPatchBinary,
  INVALID_INPUT_ERROR,
  isValidClaimStatusValue,
  withArStageInitialization,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { claimProvenanceRequest, commitWithProvenance, resolveClaimActor, versionedReference } from '../provenance';
import { createBillingClient, fetchById } from '../shared';
import { SetClaimStatusParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'set-billing-claim-status';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const agent = await resolveClaimActor(oystehr, input.headers?.Authorization, params.secrets);

  const response = await performEffect(oystehr, params, agent);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: Oystehr,
  params: SetClaimStatusParams,
  agent: ProvenanceAgent
): Promise<{ ok: true }> {
  const field = CLAIM_STATUS_FIELDS_BY_KEY[params.field];
  // Empty/null clears the tag back to the field default.
  const value = params.value ?? '';
  if (!isValidClaimStatusValue(field, value)) {
    throw INVALID_INPUT_ERROR(`Invalid value "${value}" for claim status field "${params.field}"`);
  }

  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);

  // Apply the change to the claim's current status values, then — when setting AR Stage — run the same
  // stage-initialization rule used at claim creation so a freshly-entered stage doesn't sit at "None".
  const values: ClaimStatusValues = { ...getClaimStatusValues(claim), [params.field]: value };
  const updatedValues = params.field === 'arStage' ? withArStageInitialization(values) : values;

  // Rebuild this claim's status tags from the values while preserving every non-status tag.
  const statusSystems = new Set(CLAIM_STATUS_FIELDS.map((f) => f.system));
  const updatedTags = [
    ...(claim.meta?.tag ?? []).filter((t) => !t.system || !statusSystems.has(t.system)),
    ...claimStatusValuesToTags(updatedValues),
  ];

  const versionId = claim.meta?.versionId;
  const afterClaim = { ...claim, meta: { ...claim.meta, tag: updatedTags } };

  // Patch and Provenance commit atomically. The status change is read from the claim's meta tags, so
  // the diff surfaces exactly which status field changed.
  const provenance = claimProvenanceRequest({
    resourceType: 'Claim',
    targetReference: `Claim/${params.claimId}`,
    before: claim,
    after: afterClaim,
    agent,
    activity: 'statusChange',
    recorded: new Date().toISOString(),
    priorVersionReference: versionedReference(claim),
  });
  await commitWithProvenance(
    oystehr,
    getPatchBinary({
      resourceType: 'Claim',
      resourceId: params.claimId,
      patchOperations: [{ op: 'add', path: '/meta/tag', value: updatedTags }],
      ifMatch: versionId ? `W/"${versionId}"` : undefined,
    }),
    provenance
  );

  return { ok: true };
}
