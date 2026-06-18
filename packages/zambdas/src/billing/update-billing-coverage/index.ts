import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coverage, Patient } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  createBillingClient,
  fetchById,
  getPayerOrgById,
  linkCoverageToAccount,
  setCoveragePayer,
  setCoverageSubscriber,
  toAddressParts,
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

  if (params.status) coverage.status = params.status;

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
    let policyHolder = params.policyHolder ? { ...params.policyHolder } : undefined;
    if (policyHolder?.sameAsPatientAddress) {
      const patient = await fetchById<Patient>(oystehr, 'Patient', patientId);
      policyHolder = { ...policyHolder, address: toAddressParts(patient.address?.[0]) };
    }
    setCoverageSubscriber(coverage, patientId, params.relationship, policyHolder);
  }

  if (params.order !== undefined) coverage.order = params.order;

  const updated = await oystehr.fhir.update<Coverage>(coverage);

  if (params.order !== undefined) {
    await linkCoverageToAccount(oystehr, patientId, params.coverageId, params.order);
  }

  return { id: updated.id };
}
