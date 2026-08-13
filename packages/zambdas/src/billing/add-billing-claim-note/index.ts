import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ProvenanceAgent } from 'fhir/r4b';
import { OkResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { commitClaimNote, resolveClaimActor } from '../provenance';
import { createBillingClient, fetchById } from '../shared';
import { AddClaimNoteParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'add-billing-claim-note';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  console.groupEnd();
  const { secrets, userToken, message, ...restOfParams } = params;
  console.debug('validateRequestParameters success', restOfParams, `length: ${message.length}`);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('complexValidation');
  const agent = await complexValidation(oystehr, params, userToken);
  console.groupEnd();
  console.debug('complexValidation success');

  console.group('performEffect');
  const response = await performEffect(oystehr, params, agent);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function complexValidation(
  oystehr: Oystehr,
  params: AddClaimNoteParams,
  authorizationHeader: string | undefined
): Promise<ProvenanceAgent> {
  return resolveClaimActor('caller', oystehr, authorizationHeader, params.secrets);
}

export async function performEffect(
  oystehr: Oystehr,
  params: AddClaimNoteParams,
  agent: ProvenanceAgent
): Promise<OkResponse> {
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);
  await commitClaimNote(oystehr, claim, params.message, agent);

  return { ok: true };
}
