import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Coverage, ProvenanceAgent, RelatedPerson } from 'fhir/r4b';
import { APIErrorCode, FHIR_RESOURCE_NOT_FOUND, setCoveragePlanType } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { commitClaimResourceChange, diffResources, resolveClaimActor } from '../provenance';
import {
  BillingFhirResource,
  buildSubscriberRelatedPerson,
  coverageInsuranceTypeLabel,
  createBillingClient,
  fetchById,
  findCoverageOfType,
  getPatientAccounts,
  reconcileAccountsForCoverage,
  setCoveragePayer,
  setCoverageRelationship,
} from '../shared';
import { UpdateBillingCoverageParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'update-billing-coverage';

interface ComplexValidationResult {
  patientId: string;
  coverage: Coverage;
  agent?: ProvenanceAgent;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const cvo = await complexValidation(params, oystehr, input.headers?.Authorization);

  const response = await performEffect(oystehr, params, cvo);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function complexValidation(
  params: UpdateBillingCoverageParams,
  oystehr: Oystehr,
  authorizationHeader: string | undefined
): Promise<ComplexValidationResult> {
  const coverage = await fetchById<Coverage>(oystehr, 'Coverage', params.coverageId);
  const patientId = coverage.beneficiary?.reference?.split('/')[1];
  if (!patientId) throw FHIR_RESOURCE_NOT_FOUND('Patient');

  // Don't let this coverage take an insurance type another active coverage already holds.
  if (params.insuranceType !== undefined) {
    const occupying = await findCoverageOfType(oystehr, patientId, params.insuranceType, params.coverageId);
    if (occupying) {
      throw {
        code: APIErrorCode.ALREADY_EXISTS,
        message: `This patient already has a ${coverageInsuranceTypeLabel(
          params.insuranceType
        )} coverage. Remove or change it before assigning another.`,
      };
    }
  }

  // A claim-scoped edit (the claim screen editing the claim's coverage working copy) is recorded in
  // that claim's history, so it needs the acting user; master-screen edits carry no claim context
  // and keep working without a resolvable caller.
  const agent = params.claimId
    ? await resolveClaimActor('caller', oystehr, authorizationHeader, params.secrets)
    : undefined;

  return { patientId, coverage, agent };
}

export async function performEffect(
  oystehr: Oystehr,
  params: UpdateBillingCoverageParams,
  cvo: ComplexValidationResult
): Promise<{ id: string | undefined }> {
  const { patientId, agent } = cvo;
  let coverage = structuredClone(cvo.coverage);
  const accounts = params.insuranceType !== undefined ? await getPatientAccounts(oystehr, patientId) : [];

  // Coverage status is not part of the billing product model; keep every coverage active.
  coverage.status = 'active';

  const effectiveMemberId = params.memberId ?? coverage.subscriberId ?? '';
  if (params.payerId) {
    // Re-pointing the payer rebuilds payor reference, coverage class, and the member-id identifier.
    const payerOrg = await oystehr.rcm.getPayer({ id: params.payerId });
    setCoveragePayer(coverage, payerOrg, effectiveMemberId);
    coverage.subscriberId = effectiveMemberId;
  } else if (params.memberId !== undefined) {
    coverage.subscriberId = params.memberId;
    if (coverage.identifier?.[0]) coverage.identifier[0].value = params.memberId;
  }

  // RelatedPerson create/update happens before the Coverage PUT; a delete happens after (so the
  // coverage no longer references it). All of it goes in one transaction.
  const preCoverageRequests: BatchInputRequest<BillingFhirResource>[] = [];
  const postCoverageRequests: BatchInputRequest<BillingFhirResource>[] = [];

  let newSubscriber: RelatedPerson | undefined;
  let currentSubscriberId: string | undefined;
  if (params.relationship) {
    setCoverageRelationship(coverage, params.relationship);
    const currentRef = coverage.subscriber?.reference;
    currentSubscriberId = currentRef?.startsWith('RelatedPerson/') ? currentRef.split('/')[1] : undefined;

    if (params.relationship === 'Self' || !params.policyHolder) {
      coverage.subscriber = { reference: `Patient/${patientId}` };
      if (currentSubscriberId) {
        postCoverageRequests.push({ method: 'DELETE', url: `RelatedPerson/${currentSubscriberId}` });
      }
    } else {
      newSubscriber = buildSubscriberRelatedPerson(patientId, params.relationship, params.policyHolder);
      if (currentSubscriberId) {
        newSubscriber.id = currentSubscriberId;
        preCoverageRequests.push({
          method: 'PUT',
          url: `RelatedPerson/${currentSubscriberId}`,
          resource: newSubscriber,
        });
        coverage.subscriber = { reference: `RelatedPerson/${currentSubscriberId}` };
      } else {
        const subscriberUrn = `urn:uuid:${randomUUID()}`;
        preCoverageRequests.push({
          method: 'POST',
          url: '/RelatedPerson',
          resource: newSubscriber,
          fullUrl: subscriberUrn,
        });
        coverage.subscriber = { reference: subscriberUrn };
      }
    }
  }

  if (params.planType) {
    coverage = setCoveragePlanType(coverage, params.planType);
  }

  // Moving insurance type re-homes the coverage to the right account (PBILLACCT vs WCOMPACCT).
  const accountRequests =
    params.insuranceType !== undefined
      ? reconcileAccountsForCoverage(accounts, patientId, `Coverage/${params.coverageId}`, params.insuranceType)
      : [];

  if (params.claimId && agent) {
    // Claim-scoped edit: write the coverage update and its claim-history Provenance in the same
    // transaction. Policy-holder edits ride on the subscriber RelatedPerson, which the coverage
    // projection can't see — fold them in as `policyHolder.*` changes, mirroring update-billing-claim.
    const currentSubscriber =
      params.relationship && currentSubscriberId
        ? await fetchById<RelatedPerson>(oystehr, 'RelatedPerson', currentSubscriberId)
        : undefined;
    const policyHolderChanges = diffResources(currentSubscriber, newSubscriber).map((change) => ({
      ...change,
      field: `policyHolder.${change.field}`,
      label: `Policy Holder ${change.label}`,
    }));
    await commitClaimResourceChange(oystehr, {
      resource: coverage,
      before: cvo.coverage,
      agent,
      claimReference: `Claim/${params.claimId}`,
      extraChanges: policyHolderChanges,
      preRequests: preCoverageRequests,
      postRequests: [...accountRequests, ...postCoverageRequests],
    });
    return { id: params.coverageId };
  }

  const requests: BatchInputRequest<BillingFhirResource>[] = [
    ...preCoverageRequests,
    { method: 'PUT', url: `Coverage/${params.coverageId}`, resource: coverage },
    ...accountRequests,
    ...postCoverageRequests,
  ];

  await oystehr.fhir.transaction<BillingFhirResource>({ requests });
  return { id: params.coverageId };
}
