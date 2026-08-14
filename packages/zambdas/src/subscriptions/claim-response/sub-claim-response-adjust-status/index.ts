import Oystehr, { FhirResourceReturnValue } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse } from 'fhir/r4b';
import { patchWithOptimisticLock } from 'utils/lib/fhir/helpers';
import { getPatchOperationForNewMetaTag } from 'utils/lib/fhir/resourcePatch';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { createBillingClient, getTag } from '../../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'sub-claim-response-adjust-status';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('complexValidation');
  const validated = await complexValidation(oystehr, params.claimResponseId);
  console.groupEnd();

  console.group('performEffect');
  const response = await performEffect(oystehr, validated);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export interface ComplexValidationOutput {
  claimResponseId: string;
  claimResponse: FhirResourceReturnValue<ClaimResponse>;
  claim: FhirResourceReturnValue<Claim>;
}

export async function complexValidation(oystehr: Oystehr, claimResponseId: string): Promise<ComplexValidationOutput> {
  const claimResponse = await oystehr.fhir.get<ClaimResponse>({ resourceType: 'ClaimResponse', id: claimResponseId });
  if (!claimResponse.request?.reference) {
    throw new Error(`Subscription called for ClaimResponse without 'request'`);
  }
  const claim = await oystehr.fhir.get<Claim>({
    resourceType: 'Claim',
    id: claimResponse.request.reference.replace('Claim/', ''),
  });

  return {
    claim,
    claimResponse,
    claimResponseId,
  };
}

export async function performEffect(oystehr: Oystehr, validated: ComplexValidationOutput): Promise<void> {
  const { claim } = validated;
  const arStage = getTag(claim, CLAIM_STATUS_TAG_SYSTEMS.arStage);
  if (arStage !== AR_STAGE.insurancePayer) {
    return;
  }
  const insuranceArStatus = getTag(claim, CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus);
  if (insuranceArStatus === 'adjudicated') {
    return;
  }
  await patchWithOptimisticLock(oystehr, claim, (claim) => [
    getPatchOperationForNewMetaTag(claim, {
      system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus,
      code: 'adjudicated',
    }),
  ]);
}
