import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coverage, RelatedPerson } from 'fhir/r4b';
import { BillingCoverageOption, genderMap, getMemberIdFromCoverage, getPayerId } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  COVERAGE_SUBSCRIBER_CONTAINED_ID,
  createBillingClient,
  EXCLUDE_WORKING_COPIES_PARAMS,
  getCoverageInsuranceType,
  getPatientBillingAccount,
  getPatientWorkersCompAccount,
  resolvePayersByRef,
  toAddressParts,
} from '../shared';
import { GetPatientCoveragesParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-patient-coverages';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

function extractPolicyHolder(coverage: Coverage): BillingCoverageOption['policyHolder'] {
  const subscriber = coverage.contained?.find(
    (r): r is RelatedPerson => r.resourceType === 'RelatedPerson' && r.id === COVERAGE_SUBSCRIBER_CONTAINED_ID
  );
  if (!subscriber) return null;
  const name = subscriber.name?.[0];
  return {
    firstName: name?.given?.[0] ?? '',
    middleName: name?.given?.[1] ?? '',
    lastName: name?.family ?? '',
    dob: subscriber.birthDate ?? '',
    birthSex: subscriber.gender ? genderMap[subscriber.gender as keyof typeof genderMap] ?? '' : '',
    addressParts: toAddressParts(subscriber.address?.[0]),
  };
}

async function performEffect(
  oystehr: Oystehr,
  params: GetPatientCoveragesParams
): Promise<{ coverages: BillingCoverageOption[] }> {
  const [response, pbillAccount, wcompAccount] = await Promise.all([
    oystehr.fhir.search<Coverage>({
      resourceType: 'Coverage',
      params: [{ name: 'beneficiary', value: `Patient/${params.patientId}` }, ...EXCLUDE_WORKING_COPIES_PARAMS],
    }),
    getPatientBillingAccount(oystehr, params.patientId),
    getPatientWorkersCompAccount(oystehr, params.patientId),
  ]);

  const coverages = response.unbundle();
  const payersByRef = await resolvePayersByRef(
    oystehr,
    coverages.map((cov) => cov.payor?.[0]?.reference)
  );

  const result = coverages.map((cov) => {
    const payorRef = cov.payor?.[0]?.reference;
    const payorOrg = payorRef ? payersByRef.get(payorRef) : undefined;

    return {
      id: cov.id,
      status: cov.status,
      subscriberId: cov.subscriberId ?? '',
      payorName: payorOrg?.name ?? '',
      payorId: getPayerId(payorOrg) ?? '',
      payorFhirId: payorOrg?.id ?? '',
      insuranceType: getCoverageInsuranceType(cov, pbillAccount, wcompAccount),
      relationship: cov.relationship?.coding?.[0]?.display ?? '',
      memberId: cov.subscriberId ?? getMemberIdFromCoverage(cov) ?? '',
      policyHolder: extractPolicyHolder(cov),
    };
  });

  return { coverages: result };
}
