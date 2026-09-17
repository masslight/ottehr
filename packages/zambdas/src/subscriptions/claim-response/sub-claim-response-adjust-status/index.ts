import Oystehr, { FhirResourceReturnValue } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse, ProvenanceAgent } from 'fhir/r4b';
import { withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import { Secrets } from 'utils/lib/secrets';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import {
  HOLD_TAG_NAME,
  SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
  SECONDARY_SUBMISSION_TAG_NAME,
} from 'utils/lib/types/data/billing/system-tags';
import { commitClaimMetaTagsWithProvenance, resolveClaimActor } from '../../../billing/provenance';
import { buildUpdatedClaimStatusTags, createBillingClient, getTag } from '../../../billing/shared';
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
  const validated = await complexValidation(oystehr, params.claimResponseId, secrets);
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
  agent: ProvenanceAgent;
}

export async function complexValidation(
  oystehr: Oystehr,
  claimResponseId: string,
  secrets: Secrets
): Promise<ComplexValidationOutput> {
  const claimResponse = await oystehr.fhir.get<ClaimResponse>({ resourceType: 'ClaimResponse', id: claimResponseId });
  if (!claimResponse.request?.reference) {
    throw new Error(`Subscription called for ClaimResponse without 'request'`);
  }
  const claim = await oystehr.fhir.get<Claim>({
    resourceType: 'Claim',
    id: claimResponse.request.reference.replace('Claim/', ''),
  });

  const agent = await resolveClaimActor('system', oystehr, undefined, secrets);

  return {
    claim,
    claimResponse,
    claimResponseId,
    agent,
  };
}

interface StatusAdjustmentPlan {
  targetARStatus: string;
  tagsToAdd: string[];
}

function planStatusAdjustment(claim: Claim, claimResponse: ClaimResponse): StatusAdjustmentPlan | undefined {
  if (getTag(claim, CLAIM_STATUS_TAG_SYSTEMS.arStage) !== AR_STAGE.insurancePayer) {
    return undefined;
  }
  if (getTag(claim, CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus) === 'adjudicated') {
    return undefined;
  }
  if (claim.insurance.length <= 1) {
    return {
      targetARStatus: 'adjudicated',
      tagsToAdd: [],
    };
  }
  // Flag for secondary submission
  return claimWasForwarded(claimResponse)
    ? {
        // No action necessary by biller
        targetARStatus: 'submitted',
        tagsToAdd: [SECONDARY_SUBMISSION_TAG_NAME, SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME],
      }
    : {
        // Hold for biller to manually submit
        targetARStatus: 'adjudicated',
        tagsToAdd: [SECONDARY_SUBMISSION_TAG_NAME, HOLD_TAG_NAME],
      };
}

export async function performEffect(oystehr: Oystehr, validated: ComplexValidationOutput): Promise<void> {
  const { claim, claimResponse } = validated;

  await withVersionConflictRetries(async (attempt) => {
    const current = attempt === 1 ? claim : await oystehr.fhir.get<Claim>({ resourceType: 'Claim', id: claim.id });
    const plan = planStatusAdjustment(current, claimResponse);
    if (!plan) {
      if (attempt > 1) {
        console.log(`Claim/${current.id} no longer needs this adjustment after the conflict, skipping`);
      }
      return;
    }
    const updatedTags = plan.tagsToAdd.reduce(
      (tags, name) =>
        tags.some((t) => t.system === CLAIM_TAG_SYSTEM && t.code === name)
          ? tags
          : [
              ...tags,
              {
                system: CLAIM_TAG_SYSTEM,
                code: name,
              },
            ],
      buildUpdatedClaimStatusTags(current, 'insuranceArStatus', plan.targetARStatus)
    );
    await commitClaimMetaTagsWithProvenance(oystehr, current, updatedTags, 'statusChange', validated.agent);
  });
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
