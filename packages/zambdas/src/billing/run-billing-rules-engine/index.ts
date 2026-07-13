import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Task } from 'fhir/r4b';
import { InternalError, RunBillingRulesEngineResponse } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { buildRulesEngineKickoffTask } from '../rules-engine/serialization';
import { createBillingClient, fetchById } from '../shared';
import { RunBillingRulesEngineParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'run-billing-rules-engine';

// Manually kick off the pre-submission rules engine for an existing claim. Enqueues the same Task
// create-billing-claim does; a Subscription then runs sub-presubmission-rules-engine. Exposed so the
// engine can be triggered (and tested) on demand from the claim detail view.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  await complexValidation(oystehr, params);
  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// Confirm the claim exists so the caller gets a clear error rather than a silently orphaned Task.
async function complexValidation(oystehr: Oystehr, params: RunBillingRulesEngineParams): Promise<Claim> {
  return fetchById<Claim>(oystehr, 'Claim', params.claimId);
}

async function performEffect(
  oystehr: Oystehr,
  params: RunBillingRulesEngineParams
): Promise<RunBillingRulesEngineResponse> {
  const task = await oystehr.fhir.create<Task>(buildRulesEngineKickoffTask(params.claimId));
  if (!task.id) throw InternalError;
  return { taskId: task.id };
}
