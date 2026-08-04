import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ClaimResponse } from 'fhir/r4b';
import {
  CODE_SYSTEM_CLAIM_TYPE,
  codeableConcept,
  getPatchBinary,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  UnmatchClaimResponseInput,
  UnmatchClaimResponseInputSchema,
} from 'utils';
import { checkOrCreateM2MClientToken, safeValidate, validateJsonBody, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient } from '../shared';

const UNKNOWN_REFERENCE = {
  display: 'Unknown',
};

let m2mToken: string;
const ZAMBDA_NAME = 'unmatch-claim-response';

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
  const claimResponse = await oystehr.fhir.get<ClaimResponse>({
    resourceType: 'ClaimResponse',
    id: params.claimResponseId,
  });
  const containedClaim = claimResponse.contained?.find((resource) => resource.resourceType === 'Claim');
  const containedPatient = claimResponse.contained?.find((resource) => resource.resourceType === 'Patient');

  const bundle = await oystehr.fhir.transaction({
    requests: [
      getPatchBinary({
        resourceType: 'ClaimResponse',
        resourceId: claimResponse.id!,
        patchOperations: [
          {
            op: 'replace',
            path: '/request',
            value: containedClaim
              ? {
                  reference: '#' + containedClaim?.id,
                }
              : UNKNOWN_REFERENCE,
          },
          {
            op: 'replace',
            path: '/insurer',
            value: containedClaim?.insurer ?? UNKNOWN_REFERENCE,
          },
          {
            op: 'replace',
            path: '/patient',
            value: containedClaim
              ? {
                  reference: '#' + containedPatient?.id,
                }
              : UNKNOWN_REFERENCE,
          },
          {
            op: 'replace',
            path: '/type',
            value: codeableConcept('unknown', CODE_SYSTEM_CLAIM_TYPE, 'Unknown'),
          },
        ],
      }),
    ],
  });
  return bundle.unbundle()[0] as ClaimResponse;
}

interface Params extends UnmatchClaimResponseInput {
  secrets: ZambdaInput['secrets'];
}

function validateRequestParameters(input: ZambdaInput): Params {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(UnmatchClaimResponseInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
