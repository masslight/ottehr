import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coverage, RelatedPerson } from 'fhir/r4b';
import { APIErrorCode, FHIR_RESOURCE_NOT_FOUND } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  applyInsuranceTypeToCoverage,
  buildSubscriberRelatedPerson,
  coverageInsuranceTypeLabel,
  createBillingClient,
  fetchById,
  findCoverageOfType,
  getPayerOrgById,
  linkCoverageToAccount,
  setCoveragePayer,
  setCoverageRelationship,
  unlinkCoverageFromAccount,
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

  if (params.relationship) {
    setCoverageRelationship(coverage, params.relationship);
    // The subscriber is a standalone RelatedPerson (non-self) or the patient (self). Reconcile it
    // against whatever the coverage currently points at.
    const currentRef = coverage.subscriber?.reference;
    const currentSubscriberId = currentRef?.startsWith('RelatedPerson/') ? currentRef.split('/')[1] : undefined;

    if (params.relationship === 'Self' || !params.policyHolder) {
      coverage.subscriber = { reference: `Patient/${patientId}` };
      if (currentSubscriberId) await oystehr.fhir.delete({ resourceType: 'RelatedPerson', id: currentSubscriberId });
    } else {
      const subscriber = buildSubscriberRelatedPerson(patientId, params.relationship, params.policyHolder);
      if (currentSubscriberId) {
        subscriber.id = currentSubscriberId;
        const saved = await oystehr.fhir.update<RelatedPerson>(subscriber);
        coverage.subscriber = { reference: `RelatedPerson/${saved.id}` };
      } else {
        const created = await oystehr.fhir.create<RelatedPerson>(subscriber);
        coverage.subscriber = { reference: `RelatedPerson/${created.id}` };
      }
    }
  }

  if (params.insuranceType !== undefined) applyInsuranceTypeToCoverage(coverage, params.insuranceType);

  const updated = await oystehr.fhir.update<Coverage>(coverage);

  // Moving insurance type re-homes the coverage to the right account (PBILLACCT vs WCOMPACCT).
  if (params.insuranceType !== undefined) {
    await unlinkCoverageFromAccount(oystehr, patientId, params.coverageId);
    await linkCoverageToAccount(oystehr, patientId, params.coverageId, params.insuranceType);
  }

  return { id: updated.id };
}
