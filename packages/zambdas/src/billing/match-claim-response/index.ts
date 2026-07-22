import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse } from 'fhir/r4b';
import {
  getPatchBinary,
  MatchClaimResponseToClaimInput,
  MatchClaimResponseToClaimInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { checkOrCreateM2MClientToken, safeValidate, validateJsonBody, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'match-claim-response';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function performEffect(oystehr: Oystehr, params: Params): Promise<ClaimResponse> {
  const claim = await oystehr.fhir.get<Claim>({
    resourceType: 'Claim',
    id: params.claimId,
  });
  const claimResponse = await oystehr.fhir.get<ClaimResponse>({
    resourceType: 'ClaimResponse',
    id: params.claimResponseId,
  });
  const bundle = await oystehr.fhir.transaction({
    requests: [
      getPatchBinary({
        resourceType: 'ClaimResponse',
        resourceId: claimResponse.id!,
        patchOperations: [
          {
            op: 'replace',
            path: '/request',
            value: {
              reference: 'Claim/' + claim.id,
            },
          },
          {
            op: 'replace',
            path: '/insurer',
            value: claim.insurer,
          },
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
          {
            op: 'remove',
            path: '/contained',
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
