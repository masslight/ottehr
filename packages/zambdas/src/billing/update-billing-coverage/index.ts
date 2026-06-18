import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Coverage } from 'fhir/r4b';
import { APIErrorCode, FHIR_RESOURCE_NOT_FOUND } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  applyInsuranceTypeToCoverage,
  BillingFhirResource,
  buildSubscriberRelatedPerson,
  coverageInsuranceTypeLabel,
  createBillingClient,
  fetchById,
  findCoverageOfType,
  getPatientAccounts,
  getPayerOrgById,
  reconcileAccountsForCoverage,
  setCoveragePayer,
  setCoverageRelationship,
} from '../shared';
import { UpdateBillingCoverageParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'update-billing-coverage';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  oystehr: Oystehr,
  params: UpdateBillingCoverageParams
): Promise<{ id: string | undefined }> {
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

  const accounts = params.insuranceType !== undefined ? await getPatientAccounts(oystehr, patientId) : [];

  // Coverage status is not part of the billing product model; keep every coverage active.
  coverage.status = 'active';

  const effectiveMemberId = params.memberId ?? coverage.subscriberId ?? '';
  if (params.payerId) {
    // Re-pointing the payer rebuilds payor reference, coverage class, and the member-id identifier.
    const payerOrg = await getPayerOrgById(oystehr, params.payerId);
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

  if (params.relationship) {
    setCoverageRelationship(coverage, params.relationship);
    const currentRef = coverage.subscriber?.reference;
    const currentSubscriberId = currentRef?.startsWith('RelatedPerson/') ? currentRef.split('/')[1] : undefined;

    if (params.relationship === 'Self' || !params.policyHolder) {
      coverage.subscriber = { reference: `Patient/${patientId}` };
      if (currentSubscriberId) {
        postCoverageRequests.push({ method: 'DELETE', url: `RelatedPerson/${currentSubscriberId}` });
      }
    } else {
      const subscriber = buildSubscriberRelatedPerson(patientId, params.relationship, params.policyHolder);
      if (currentSubscriberId) {
        subscriber.id = currentSubscriberId;
        preCoverageRequests.push({
          method: 'PUT',
          url: `RelatedPerson/${currentSubscriberId}`,
          resource: subscriber,
        });
        coverage.subscriber = { reference: `RelatedPerson/${currentSubscriberId}` };
      } else {
        const subscriberUrn = `urn:uuid:${randomUUID()}`;
        preCoverageRequests.push({
          method: 'POST',
          url: '/RelatedPerson',
          resource: subscriber,
          fullUrl: subscriberUrn,
        });
        coverage.subscriber = { reference: subscriberUrn };
      }
    }
  }

  if (params.insuranceType !== undefined) applyInsuranceTypeToCoverage(coverage, params.insuranceType);

  const requests: BatchInputRequest<BillingFhirResource>[] = [
    ...preCoverageRequests,
    { method: 'PUT', url: `Coverage/${params.coverageId}`, resource: coverage },
    // Moving insurance type re-homes the coverage to the right account (PBILLACCT vs WCOMPACCT).
    ...(params.insuranceType !== undefined
      ? reconcileAccountsForCoverage(accounts, patientId, `Coverage/${params.coverageId}`, params.insuranceType)
      : []),
    ...postCoverageRequests,
  ];

  await oystehr.fhir.transaction<BillingFhirResource>({ requests });
  return { id: params.coverageId };
}
