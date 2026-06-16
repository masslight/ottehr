import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim } from 'fhir/r4b';
import { CLAIM_STATUS_FIELDS_BY_KEY, getActiveStatusGroup, INVALID_INPUT_ERROR, isValidClaimStatusValue } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, fetchById } from '../shared';
import { SetClaimStatusParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'set-billing-claim-status';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: SetClaimStatusParams): Promise<{ ok: true }> {
  const field = CLAIM_STATUS_FIELDS_BY_KEY[params.field];
  // Empty/null clears the tag back to the field default.
  const value = params.value ?? '';
  if (!isValidClaimStatusValue(field, value)) {
    throw INVALID_INPUT_ERROR(`Invalid value "${value}" for claim status field "${params.field}"`);
  }

  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);

  // Replace this field's tag while preserving every other tag (other status fields, claim tags, etc.).
  const updatedTags = (claim.meta?.tag ?? []).filter((t) => t.system !== field.system);
  if (value) updatedTags.push({ system: field.system, code: value });

  // Entering an AR Stage initializes that stage's progress status (e.g. Insurance Status -> "Created")
  // to its first value when it hasn't been set yet, so a freshly-entered stage doesn't sit at "None".
  if (params.field === 'arStage' && value) {
    const group = getActiveStatusGroup(value);
    const primaryField = group ? CLAIM_STATUS_FIELDS_BY_KEY[group.primaryFieldKey] : undefined;
    const firstValue = primaryField?.options[0]?.code;
    if (primaryField && firstValue && !updatedTags.some((t) => t.system === primaryField.system)) {
      updatedTags.push({ system: primaryField.system, code: firstValue });
    }
  }

  const versionId = claim.meta?.versionId;
  await oystehr.fhir.patch(
    {
      resourceType: 'Claim',
      id: params.claimId,
      operations: [{ op: 'add', path: '/meta/tag', value: updatedTags }],
    },
    versionId ? { optimisticLockingVersionId: versionId } : undefined
  );

  return { ok: true };
}
