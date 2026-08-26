import Oystehr, { FhirResourceReturnValue } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse } from 'fhir/r4b';
import { patchWithOptimisticLock } from 'utils/lib/fhir/helpers';
import { getPatchOperationForNewMetaTag } from 'utils/lib/fhir/resourcePatch';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import {
  HOLD_TAG_NAME,
  SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
  SECONDARY_SUBMISSION_TAG_NAME,
} from 'utils/lib/types/data/billing/system-tags';
import { createBillingClient, ensureSystemManagedTags, getTag } from '../../../billing/shared';
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
  const { claim, claimResponse } = validated;
  const arStage = getTag(claim, CLAIM_STATUS_TAG_SYSTEMS.arStage);
  if (arStage !== AR_STAGE.insurancePayer) {
    return;
  }
  const insuranceArStatus = getTag(claim, CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus);
  if (insuranceArStatus === 'adjudicated') {
    return;
  }
  let targetARStatus = 'adjudicated';
  const tagsToAdd: string[] = [];
  if (claim.insurance.length > 1) {
    // Flag for secondary submission
    tagsToAdd.push(SECONDARY_SUBMISSION_TAG_NAME);
    if (claimWasForwarded(claimResponse)) {
      // No action necessary by biller
      targetARStatus = 'submitted';
      tagsToAdd.push(SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME);
    } else {
      // Hold for biller to manually submit
      targetARStatus = 'adjudicated';
      tagsToAdd.push(HOLD_TAG_NAME);
    }
  }

  try {
    await ensureSystemManagedTags(oystehr);
  } catch (error) {
    console.error('Failed to ensure system-managed tags exist:', error);
  }

  await patchWithOptimisticLock(oystehr, claim, (claim) => [
    getPatchOperationForNewMetaTag(claim, {
      system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus,
      code: targetARStatus,
    }),
    ...tagsToAdd.map((t) => getPatchOperationForNewMetaTag(claim, { system: CLAIM_TAG_SYSTEM, code: t })),
  ]);
}

function claimWasForwarded(claimResponse: ClaimResponse): boolean {
  const medicareRemarkCodes = (claimResponse.extension ?? [])
    .filter(
      (ext) =>
        ext.url.startsWith('https://extensions.fhir.oystehr.com/era-inpatient-remark-code-') ||
        ext.url.startsWith('https://extensions.fhir.oystehr.com/era-outpatient-remark-code-')
    )
    .map((ext) => ext.valueString)
    .filter((val): val is string => !!val);
  const serviceLineRemarkCodes = (claimResponse.item ?? []).flatMap((item) =>
    (item.extension ?? [])
      .filter((ext) => ext.url === 'https://extensions.fhir.oystehr.com/era-item-remark-code')
      .map((ext) => ext.valueString)
      .filter((val): val is string => !!val)
  );
  if (medicareRemarkCodes.some((val) => val === 'MA18') || serviceLineRemarkCodes.some((val) => val === 'N89')) {
    return true;
  }
  return false;
}
