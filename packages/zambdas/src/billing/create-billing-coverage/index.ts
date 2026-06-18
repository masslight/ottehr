import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coverage, RelatedPerson } from 'fhir/r4b';
import { APIErrorCode } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  buildBillingCoverage,
  buildSubscriberRelatedPerson,
  coverageInsuranceTypeLabel,
  createBillingClient,
  findCoverageOfType,
  getPayerOrgById,
  linkCoverageToAccount,
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
  // Only one coverage may hold each insurance type (primary / secondary / workers' comp) per patient.
  const occupying = await findCoverageOfType(oystehr, params.patientId, params.insuranceType);
  if (occupying) {
    throw {
      code: APIErrorCode.ALREADY_EXISTS,
      message: `This patient already has a ${coverageInsuranceTypeLabel(
        params.insuranceType
      )} coverage. Remove or change it before adding another.`,
    };
  }

  const payerOrg = await getPayerOrgById(oystehr, params.payerId);

  // Non-self subscribers are standalone RelatedPerson resources (matching
  // create-billing-claim-from-encounter), referenced by the Coverage.
  let subscriberReference = `Patient/${params.patientId}`;
  if (params.relationship !== 'Self' && params.policyHolder) {
    const subscriber = await oystehr.fhir.create<RelatedPerson>(
      buildSubscriberRelatedPerson(params.patientId, params.relationship, params.policyHolder)
    );
    subscriberReference = `RelatedPerson/${subscriber.id}`;
  }

  const coverage = buildBillingCoverage({
    patientId: params.patientId,
    payerOrg,
    memberId: params.memberId,
    // Coverage status is not part of the billing product model; every coverage is active.
    status: 'active',
    insuranceType: params.insuranceType,
    relationship: params.relationship,
    subscriberReference,
  });

  const created = await oystehr.fhir.create<Coverage>(coverage);
  await linkCoverageToAccount(oystehr, params.patientId, created.id!, params.insuranceType);
  return { id: created.id! };
}
