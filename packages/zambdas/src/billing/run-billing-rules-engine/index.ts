import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ProvenanceAgent, Task } from 'fhir/r4b';
import { InternalError } from 'utils/lib/helpers/oystehrApi';
import { RulesEngineType } from 'utils/lib/types/data/billing/rules-engine.constants';
import { RunBillingRulesEngineResponse } from 'utils/lib/types/data/billing/rules-engine.schemas';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { resolveClaimActor } from '../provenance';
import { buildRulesEngineKickoffTask } from '../rules-engine/serialization';
import { createBillingClient, determineRulesEngineForClaim } from '../shared';
import { RunBillingRulesEngineParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'run-billing-rules-engine';

// Manually kick off the rules engine for one or more existing claims — the Submit claim / Prepare
// for invoice buttons and the claims list bulk submit all land here. Each claim's engine is decided
// by its AR stage (see determineRulesEngineForClaim); this enqueues the same Tasks claim creation
// does, and a Subscription then runs sub-rules-engine for each.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const kickoffs = await complexValidation(oystehr, params);
  const agent = await resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets);
  const response = await performEffect(oystehr, kickoffs, agent);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export interface RulesEngineKickoff {
  claimId: string;
  engine: RulesEngineType;
  skipRules: boolean;
}

// Confirm every claim exists (one search ORing the ids) and that an engine applies to each, so the
// caller gets a clear error rather than silently orphaned Tasks or unhandled claims.
export async function complexValidation(
  oystehr: Oystehr,
  params: RunBillingRulesEngineParams
): Promise<RulesEngineKickoff[]> {
  const result = await oystehr.fhir.search<Claim>({
    resourceType: 'Claim',
    params: [
      { name: '_id', value: params.claimIds.join(',') },
      { name: '_count', value: String(params.claimIds.length) },
    ],
  });
  const claimsById = new Map(result.unbundle().map((claim) => [claim.id, claim]));

  const missing = params.claimIds.filter((claimId) => !claimsById.has(claimId));
  if (missing.length > 0) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Claim(s) not found: ${missing.join(', ')}`);
  }

  const kickoffs: RulesEngineKickoff[] = [];
  const noEngine: string[] = [];
  for (const claimId of params.claimIds) {
    const engine = determineRulesEngineForClaim(claimsById.get(claimId)!);
    if (engine) kickoffs.push({ claimId, engine, skipRules: params.skipRules });
    else noEngine.push(claimId);
  }
  if (noEngine.length > 0) {
    throw INVALID_INPUT_ERROR(
      `No rules engine applies to claim(s): ${noEngine.join(', ')}. ` +
        'Set an AR Stage first — Patient AR claims must also be self-pay (no coverage).'
    );
  }
  return kickoffs;
}

// All kickoff Tasks are created in one transaction: either an engine is queued for every requested
// claim or for none of them, so a partial failure can't leave the caller guessing which claims ran.
export async function performEffect(
  oystehr: Oystehr,
  kickoffs: RulesEngineKickoff[],
  agent: ProvenanceAgent
): Promise<RunBillingRulesEngineResponse> {
  const requests: BatchInputPostRequest<Task>[] = kickoffs.map(({ engine, claimId, skipRules }) => ({
    method: 'POST',
    url: '/Task',
    resource: buildRulesEngineKickoffTask(engine, claimId, skipRules, agent.who),
  }));
  const result = await oystehr.fhir.transaction<Task>({ requests });
  const taskIds = (result.entry ?? [])
    .map((entry) => entry.resource?.id)
    .filter((id): id is string => id !== undefined);
  if (taskIds.length !== kickoffs.length) throw InternalError;
  return { results: kickoffs.map((kickoff, i) => ({ ...kickoff, taskId: taskIds[i] })) };
}
