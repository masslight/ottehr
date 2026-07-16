import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Task } from 'fhir/r4b';
import { InternalError, RunBillingRulesEngineResponse } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { buildRulesEngineKickoffTask } from '../rules-engine/serialization';
import { createBillingClient, fetchById } from '../shared';
import { RunBillingRulesEngineParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'run-billing-rules-engine';

// Kick off the pre-submission rules engine for one or more existing claims. Enqueues the same Task
// create-billing-claim does (one per claim); a Subscription then runs sub-presubmission-rules-engine,
// which submits or holds each claim. This is the only path to submitting a claim — the claims list
// bulk submit and the claim detail submit both go through here.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  await complexValidation(oystehr, params);
  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// Confirm every claim exists so the caller gets a clear error rather than silently orphaned Tasks.
async function complexValidation(oystehr: Oystehr, params: RunBillingRulesEngineParams): Promise<Claim[]> {
  return Promise.all(params.claimIds.map((claimId) => fetchById<Claim>(oystehr, 'Claim', claimId)));
}

// All kickoff Tasks are created in one transaction: either the engine is queued for every requested
// claim or for none of them, so a partial failure can't leave the caller guessing which claims ran.
export async function performEffect(
  oystehr: Oystehr,
  params: RunBillingRulesEngineParams
): Promise<RunBillingRulesEngineResponse> {
  const requests: BatchInputPostRequest<Task>[] = params.claimIds.map((claimId) => ({
    method: 'POST',
    url: '/Task',
    resource: buildRulesEngineKickoffTask(claimId),
  }));
  const result = await oystehr.fhir.transaction<Task>({ requests });
  const taskIds = (result.entry ?? [])
    .map((entry) => entry.resource?.id)
    .filter((id): id is string => id !== undefined);
  if (taskIds.length !== params.claimIds.length) throw InternalError;
  return { taskIds };
}
