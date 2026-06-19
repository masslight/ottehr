import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Coverage } from 'fhir/r4b';
import { APIErrorCode } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  BillingFhirResource,
  buildBillingCoverage,
  buildSubscriberRelatedPerson,
  coverageInsuranceTypeLabel,
  createBillingClient,
  findCoverageOfType,
  getPatientAccounts,
  reconcileAccountsForCoverage,
} from '../shared';
import { CreateBillingCoverageParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'create-billing-coverage';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  await complexValidation(params, oystehr);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function complexValidation(params: CreateBillingCoverageParams, oystehr: Oystehr): Promise<void> {
  // Only one coverage may hold each insurance type per patient.
  const occupying = await findCoverageOfType(oystehr, params.patientId, params.insuranceType);
  if (occupying) {
    throw {
      code: APIErrorCode.ALREADY_EXISTS,
      message: `This patient already has a ${coverageInsuranceTypeLabel(
        params.insuranceType
      )} coverage. Remove or change it before adding another.`,
    };
  }
}

async function performEffect(oystehr: Oystehr, params: CreateBillingCoverageParams): Promise<{ id: string }> {
  const [payerOrg, accounts] = await Promise.all([
    oystehr.rcm.getPayer({ id: params.payerId }),
    getPatientAccounts(oystehr, params.patientId),
  ]);

  // Coverage, its standalone policy-holder subscriber, and the account link are written in one
  // transaction so they all succeed or fail together.
  const requests: BatchInputRequest<BillingFhirResource>[] = [];

  let subscriberReference = `Patient/${params.patientId}`;
  if (params.relationship !== 'Self' && params.policyHolder) {
    const subscriberUrn = `urn:uuid:${randomUUID()}`;
    requests.push({
      method: 'POST',
      url: '/RelatedPerson',
      resource: buildSubscriberRelatedPerson(params.patientId, params.relationship, params.policyHolder),
      fullUrl: subscriberUrn,
    });
    subscriberReference = subscriberUrn;
  }

  const coverageUrn = `urn:uuid:${randomUUID()}`;
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
  requests.push({ method: 'POST', url: '/Coverage', resource: coverage, fullUrl: coverageUrn });
  requests.push(...reconcileAccountsForCoverage(accounts, params.patientId, coverageUrn, params.insuranceType));

  const result = await oystehr.fhir.transaction<BillingFhirResource>({ requests });
  const createdId = result.entry?.map((e) => e.resource).find((r): r is Coverage => r?.resourceType === 'Coverage')?.id;
  if (!createdId) throw new Error('Coverage was not created');
  return { id: createdId };
}
