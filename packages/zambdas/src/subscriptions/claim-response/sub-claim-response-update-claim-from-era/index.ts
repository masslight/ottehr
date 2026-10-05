import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, FhirResourceReturnValue } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse, Provenance, ProvenanceAgent } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { getExtensionValue, withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import { Secrets } from 'utils/lib/secrets';
import { CLAIM_TAG_SYSTEM, ERA_CLAIM_STATUS_CODE } from 'utils/lib/types/data/billing/billing.constants';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import {
  HOLD_TAG_NAME,
  SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
  SECONDARY_SUBMISSION_TAG_NAME,
} from 'utils/lib/types/data/billing/system-tags';
import { claimMetaTagsWithProvenanceRequests, resolveClaimActor } from '../../../billing/provenance';
import {
  buildUpdatedClaimStatusTags,
  CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM,
  createBillingClient,
  ERA_CLAIM_RESPONSE_TYPE_TAG,
  ERA_ICN_EXTENSION,
  ERA_ITEM_REMARK_CODE_EXTENSION,
  ERA_STATUS_CODE_EXTENSION,
  getEraExtensionString,
  getTag,
  hasTag,
} from '../../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { truncateForLog } from '../../../shared/logging';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'sub-claim-response-adjust-status';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets } = params;
  console.groupEnd();

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('complexValidation');
  const validated = await complexValidation(oystehr, params.claimResponseId, params.firedVersionId, secrets);
  console.groupEnd();

  console.group('performEffect');
  const response = await performEffect(oystehr, validated);
  console.groupEnd();
  console.debug('performEffect success', truncateForLog(response));

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
  // false when what fired this was an edit of a response already matched to the claim
  newlyMatched: boolean;
}

export async function complexValidation(
  oystehr: Oystehr,
  claimResponseId: string,
  // the version that fired the subscription, when the notification carries it
  firedVersionId: string | undefined,
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
  const newlyMatched = await firedOnNewMatch(oystehr, claimResponseId, firedVersionId ?? claimResponse.meta?.versionId);

  return {
    claim,
    claimResponse,
    claimResponseId,
    agent,
    newlyMatched,
  };
}

// The subscription is meant to act when a response gets matched to its claim: when it's created matched,
// when sub-tag-era-resources tags an imported one, or when it's matched to the claim later. Each time, the
// version before didn't qualify: it lacked a tag, or pointed elsewhere. Any other update is an edit of a
// remit claim already matched, and leaves the claim's status and ICN alone.
async function firedOnNewMatch(
  oystehr: Oystehr,
  claimResponseId: string,
  firedVersionId: string | undefined
): Promise<boolean> {
  const history = await oystehr.fhir.history<ClaimResponse>({ resourceType: 'ClaimResponse', id: claimResponseId });
  const versions = (history.entry ?? [])
    .flatMap((entry) => (entry.resource?.meta?.lastUpdated ? [entry.resource] : []))
    .sort((a, b) => (b.meta?.lastUpdated ?? '').localeCompare(a.meta?.lastUpdated ?? ''));
  const firedIndex = versions.findIndex((version) => version.meta?.versionId === firedVersionId);
  // without the fired version to compare, the claim is adjusted as it always was
  if (firedIndex === -1) return true;
  const [fired, before] = [versions[firedIndex], versions[firedIndex + 1]];
  const beforeQualified =
    !!before &&
    hasTag(before, BILLING_RESOURCE_TAG.system, BILLING_RESOURCE_TAG.code) &&
    hasTag(before, ERA_CLAIM_RESPONSE_TYPE_TAG.system ?? '', ERA_CLAIM_RESPONSE_TYPE_TAG.code ?? '') &&
    before.request?.reference === fired.request?.reference;
  return !beforeQualified;
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
  if (!validated.newlyMatched) {
    console.log(`ClaimResponse/${validated.claimResponseId} was edited, not newly matched; leaving Claim/${claim.id}`);
    return;
  }

  await withVersionConflictRetries(async (attempt) => {
    const current = attempt === 1 ? claim : await oystehr.fhir.get<Claim>({ resourceType: 'Claim', id: claim.id });
    const plan = planStatusAdjustment(current, claimResponse);
    const updatedTags = [];
    if (plan) {
      updatedTags.push(
        ...plan.tagsToAdd.reduce(
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
        )
      );
    } else if (attempt > 1) {
      console.log(`Claim/${current.id} no longer needs this adjustment after the conflict, skipping`);
    }
    const claimResponseIcn = getExtensionValue(claimResponse, ERA_ICN_EXTENSION, 'valueString');
    const requests: (BatchInputPatchRequest<Claim> | BatchInputPostRequest<Provenance>)[] = [
      ...(updatedTags.length
        ? claimMetaTagsWithProvenanceRequests(claim, updatedTags, 'statusChange', validated.agent)
        : []),
      ...(claimResponseIcn
        ? [
            {
              method: 'PATCH',
              url: `Claim/${claim.id}`,
              operations: [
                {
                  op: 'replace',
                  path: '/identifier',
                  value: [
                    ...(claim.identifier ?? []).filter(
                      (identifier) => identifier.system !== CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM
                    ),
                    {
                      system: CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM,
                      value: claimResponseIcn,
                    },
                  ],
                },
              ],
            } as BatchInputPatchRequest<Claim>,
          ]
        : []),
    ];
    if (!requests.length) {
      // Nothing to do
      return;
    }
    await oystehr.fhir.transaction({ requests });
  });
}

// CLP02 codes meaning the payer forwarded the claim to the next payer itself (crossover).
const FORWARDED_STATUS_CODES: string[] = [
  ERA_CLAIM_STATUS_CODE.primaryForwarded,
  ERA_CLAIM_STATUS_CODE.secondaryForwarded,
  ERA_CLAIM_STATUS_CODE.tertiaryForwarded,
];

export function claimWasForwarded(claimResponse: ClaimResponse): boolean {
  const statusCode = getEraExtensionString(claimResponse, ERA_STATUS_CODE_EXTENSION);
  if (statusCode && FORWARDED_STATUS_CODES.includes(statusCode)) return true;
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
      .filter((ext) => ext.url === ERA_ITEM_REMARK_CODE_EXTENSION)
      .map((ext) => ext.valueString)
      .filter((val): val is string => !!val)
  );
  // MA18 normally rides on the claim (MOA), but a remit keyed in by hand carries remark codes per line
  if (
    medicareRemarkCodes.some((val) => val === 'MA18') ||
    serviceLineRemarkCodes.some((val) => val === 'N89' || val === 'MA18')
  ) {
    return true;
  }
  return false;
}
