import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse, ProvenanceAgent } from 'fhir/r4b';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import {
  MatchClaimResponseToClaimInput,
  MatchClaimResponseToClaimInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { validateJsonBody } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { settledValueOrThrow } from '../../shared/settled';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';
import { claimMatchHistoryRequests, MATCH_FIELDS, matchFieldsPatchOperations } from '../claim-response-match';
import { assertClaimResponseEraNotVoided } from '../era-write';
import { resolveClaimActor } from '../provenance';
import { createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'match-claim-response';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const response = await performEffect(oystehr, {
    ...params,
    agent: resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets),
  });

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export async function performEffect(
  oystehr: Oystehr,
  params: Params & { agent: ProvenanceAgent | Promise<ProvenanceAgent> }
): Promise<ClaimResponse> {
  const [claimResult, claimResponseResult, agentResult] = await Promise.allSettled([
    oystehr.fhir.get<Claim>({
      resourceType: 'Claim',
      id: params.claimId,
    }),
    oystehr.fhir
      .get<ClaimResponse>({
        resourceType: 'ClaimResponse',
        id: params.claimResponseId,
      })
      .then(async (claimResponse) => {
        await assertClaimResponseEraNotVoided(oystehr, claimResponse);
        return claimResponse;
      }),
    params.agent,
  ]);
  const agent = settledValueOrThrow(agentResult);
  const claim = settledValueOrThrow(claimResult);
  const claimResponse = settledValueOrThrow(claimResponseResult);
  const matched: ClaimResponse = {
    ...claimResponse,
    request: {
      reference: 'Claim/' + claim.id,
    },
    patient: claim.patient,
    type: claim.type,
  };
  const bundle = await oystehr.fhir.transaction({
    requests: [
      getPatchBinary({
        resourceType: 'ClaimResponse',
        resourceId: claimResponse.id!,
        // Fails if a void cancelled the response after the check above.
        ifMatch: makeOptimisticLockIfMatchHeader(claimResponse),
        patchOperations: matchFieldsPatchOperations(matched, MATCH_FIELDS),
      }),
      ...claimMatchHistoryRequests({
        before: claimResponse,
        after: matched,
        agent,
      }),
    ],
  });
  return bundle.unbundle()[0] as ClaimResponse;
}

interface Params extends MatchClaimResponseToClaimInput {
  secrets: ZambdaInput['secrets'];
}

function validateRequestParameters(input: ZambdaInput): Params {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(MatchClaimResponseToClaimInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
