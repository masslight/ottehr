import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Task } from 'fhir/r4b';
import { InternalError, INVALID_INPUT_ERROR, RulesEngineType, RunBillingRulesEngineResponse } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { buildRulesEngineKickoffTask } from '../rules-engine/serialization';
import { createBillingClient, determineRulesEngineForClaim, fetchById } from '../shared';
import { RunBillingRulesEngineParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'run-billing-rules-engine';

// Manually kick off the rules engine for an existing claim — the Submit claim / Prepare for invoice
// buttons land here. The engine is decided by the claim's AR stage (see
// determineRulesEngineForClaim); this enqueues the same Task claim creation does, and a Subscription
// then runs sub-rules-engine.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const engine = await complexValidation(oystehr, params);
  const response = await performEffect(oystehr, params, engine);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// Confirm the claim exists (so the caller gets a clear error rather than a silently orphaned Task)
// and that one of the engines applies to it.
async function complexValidation(oystehr: Oystehr, params: RunBillingRulesEngineParams): Promise<RulesEngineType> {
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);
  const engine = determineRulesEngineForClaim(claim);
  if (!engine) {
    throw INVALID_INPUT_ERROR(
      'No rules engine applies to this claim. Set an AR Stage first — Patient AR claims must also be self-pay (no coverage).'
    );
  }
  return engine;
}

async function performEffect(
  oystehr: Oystehr,
  params: RunBillingRulesEngineParams,
  engine: RulesEngineType
): Promise<RunBillingRulesEngineResponse> {
  const task = await oystehr.fhir.create<Task>(buildRulesEngineKickoffTask(engine, params.claimId));
  if (!task.id) throw InternalError;
  return { taskId: task.id, engine };
}
