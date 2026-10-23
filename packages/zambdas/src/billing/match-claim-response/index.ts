import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse } from 'fhir/r4b';
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
import { assertClaimResponseEraNotVoided } from '../era-write';
import { createBillingClient, createEraReadClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'match-claim-response';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const eraReadClient = createEraReadClient(m2mToken, params.secrets);
  const response = await performEffect(oystehr, eraReadClient, params);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export async function performEffect(oystehr: Oystehr, eraReadClient: Oystehr, params: Params): Promise<ClaimResponse> {
  const claim = await oystehr.fhir.get<Claim>({
    resourceType: 'Claim',
    id: params.claimId,
  });
  const claimResponse = await oystehr.fhir.get<ClaimResponse>({
    resourceType: 'ClaimResponse',
    id: params.claimResponseId,
  });
  await assertClaimResponseEraNotVoided(eraReadClient, claimResponse);
  const bundle = await oystehr.fhir.transaction({
    requests: [
      getPatchBinary({
        resourceType: 'ClaimResponse',
        resourceId: claimResponse.id!,
        // Fails if a void cancelled the response after the check above.
        ifMatch: makeOptimisticLockIfMatchHeader(claimResponse),
        patchOperations: [
          {
            op: 'replace',
            path: '/request',
            value: {
              reference: 'Claim/' + claim.id,
            },
          },
          // insurer stays as the ERA reported it — the claim's payer may differ
          {
            op: 'replace',
            path: '/patient',
            value: claim.patient,
          },
          {
            op: 'replace',
            path: '/type',
            value: claim.type,
          },
        ],
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
