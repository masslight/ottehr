import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coverage, Patient } from 'fhir/r4b';
import { APIErrorCode } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  buildBillingCoverage,
  coverageOrderLabel,
  createBillingClient,
  fetchById,
  findCoverageOccupyingOrder,
  getPayerOrgById,
  linkCoverageToAccount,
  toAddressParts,
} from '../shared';
import { CreateBillingCoverageParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'create-billing-coverage';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: CreateBillingCoverageParams): Promise<{ id: string }> {
  // Only one coverage may hold each priority (primary / secondary) per patient.
  const occupying = await findCoverageOccupyingOrder(oystehr, params.patientId, params.order);
  if (occupying) {
    throw {
      code: APIErrorCode.ALREADY_EXISTS,
      message: `This patient already has a ${coverageOrderLabel(
        params.order
      )} coverage. Remove or change it before adding another.`,
    };
  }

  const payerOrg = await getPayerOrgById(oystehr, params.payerId);

  const policyHolder = params.policyHolder ? { ...params.policyHolder } : undefined;
  // When the policy holder shares the patient's address, copy it from the patient record.
  if (policyHolder?.sameAsPatientAddress) {
    const patient = await fetchById<Patient>(oystehr, 'Patient', params.patientId);
    policyHolder.address = toAddressParts(patient.address?.[0]);
  }

  const coverage = buildBillingCoverage({
    patientId: params.patientId,
    payerOrg,
    memberId: params.memberId,
    // Coverage status is not part of the billing product model; every coverage is active.
    status: 'active',
    order: params.order,
    relationship: params.relationship,
    policyHolder,
  });

  const created = await oystehr.fhir.create<Coverage>(coverage);
  await linkCoverageToAccount(oystehr, params.patientId, created.id!, params.order);
  return { id: created.id! };
}
