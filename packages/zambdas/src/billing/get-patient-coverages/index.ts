import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { RelatedPerson } from 'fhir/r4b';
import { getCoveragePlanType } from 'utils/lib/fhir/billing';
import { getMemberIdFromCoverage } from 'utils/lib/fhir/helpers';
import { getPayerId } from 'utils/lib/helpers/helpers';
import { BillingCoverageOption } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient, fetchPatientCoverages, resolvePayersByRef, toAddressParts } from '../shared';
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

function extractPolicyHolder(subscriber: RelatedPerson | undefined): BillingCoverageOption['policyHolder'] {
  if (!subscriber) return null;
  const name = subscriber.name?.[0];
  return {
    firstName: name?.given?.[0] ?? '',
    middleName: name?.given?.[1] ?? '',
    lastName: name?.family ?? '',
    dob: subscriber.birthDate ?? '',
    gender: subscriber.gender ?? '',
    addressParts: toAddressParts(subscriber.address?.[0]),
  };
}

async function performEffect(
  oystehr: Oystehr,
  params: GetPatientCoveragesParams
): Promise<{ coverages: BillingCoverageOption[] }> {
  // The patient's coverages (those their billing accounts reference), each already resolved to its
  // insurance type and policy holder — the same read the rules engine's "Coverage (from patient)"
  // prefetch performs.
  const records = await fetchPatientCoverages(oystehr, params.patientId);
  const payersByRef = await resolvePayersByRef(
    oystehr,
    records.map(({ coverage }) => coverage.payor?.[0]?.reference)
  );

  const result = records.map(({ coverage, insuranceType, subscriber }): BillingCoverageOption => {
    const payorRef = coverage.payor?.[0]?.reference;
    const payorOrg = payorRef ? payersByRef.get(payorRef) : undefined;

    return {
      id: coverage.id,
      status: coverage.status,
      subscriberId: coverage.subscriberId ?? '',
      payorName: payorOrg?.name ?? '',
      payorId: getPayerId(payorOrg) ?? '',
      payorFhirId: payorOrg?.id ?? '',
      insuranceType,
      planType: getCoveragePlanType(coverage),
      relationship: coverage.relationship?.coding?.[0]?.display as BillingCoverageOption['relationship'],
      memberId: coverage.subscriberId ?? getMemberIdFromCoverage(coverage) ?? '',
      policyHolder: extractPolicyHolder(subscriber),
    };
  });

  return { coverages: result };
}
