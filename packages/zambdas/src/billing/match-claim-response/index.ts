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
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';
import { claimMatchHistoryRequests, MATCH_FIELDS, matchFieldsPatchOperations } from '../claim-response-match';
import { assertClaimResponseEraNotVoided } from '../era-write';
import { resolveClaimActor } from '../provenance';
import { BillingOystehr, createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'match-claim-response';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const agent = await resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets);

  const response = await performEffect(oystehr, {
    ...params,
    agent,
  });

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export async function performEffect(
  oystehr: BillingOystehr,
  params: Params & { agent: ProvenanceAgent }
): Promise<ClaimResponse> {
  const claim = await oystehr.fhir.get<Claim>({
    resourceType: 'Claim',
    id: params.claimId,
  });
  const claimResponse = await oystehr.fhir.get<ClaimResponse>({
    resourceType: 'ClaimResponse',
    id: params.claimResponseId,
  });
  await assertClaimResponseEraNotVoided(oystehr, claimResponse);
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
        agent: params.agent,
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
