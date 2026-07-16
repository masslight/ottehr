import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ProvenanceAgent } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { applyClaimStatusField, resolveClaimActor } from '../provenance';
import { assertValidClaimStatusField, createBillingClient, fetchById } from '../shared';
import { SetClaimStatusParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'set-billing-claim-status';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const agent = await resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets);

  const response = await performEffect(oystehr, params, agent);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: Oystehr,
  params: SetClaimStatusParams,
  agent: ProvenanceAgent
): Promise<{ ok: true }> {
  const value = assertValidClaimStatusField(params.field, params.value ?? null);
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);
  await applyClaimStatusField(oystehr, claim, params.field, value, agent);
  return { ok: true };
}
