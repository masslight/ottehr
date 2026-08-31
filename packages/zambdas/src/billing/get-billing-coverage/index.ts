import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coverage, RelatedPerson } from 'fhir/r4b';
import { getCoveragePlanType } from 'utils/lib/fhir/billing';
import { getMemberIdFromCoverage } from 'utils/lib/fhir/helpers';
import { getPayerId } from 'utils/lib/helpers/helpers';
import { BillingCoverageOption, GetBillingCoverageResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient, resolvePayersByRef, toAddressParts } from '../shared';
import { GetBillingCoverageParams, validateRequestParameters } from './validateRequestParameters';

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

async function performEffect(oystehr: Oystehr, params: GetBillingCoverageParams): Promise<GetBillingCoverageResponse> {
  const coverageBundle = await oystehr.fhir.search<Coverage | RelatedPerson>({
    resourceType: 'Coverage',
    params: [
      { name: '_id', value: params.coverageId },
      { name: '_include', value: 'Coverage:subscriber' },
    ],
  });
  const records = coverageBundle.unbundle();
  const coverages = records.filter((rec): rec is Coverage => rec.resourceType === 'Coverage');
  const subscribers = records.filter((rec): rec is RelatedPerson => rec.resourceType === 'RelatedPerson');
  if (coverages.length > 1) {
    throw new Error(`Found more than one coverage for id ${params.coverageId}`);
  }
  const coverage = coverages[0];
  const payersByRef = await resolvePayersByRef(
    oystehr,
    coverages.map((coverage) => coverage.payor?.[0]?.reference)
  );

  const payorRef = coverage.payor?.[0]?.reference;
  const payorOrg = payorRef ? payersByRef.get(payorRef) : undefined;

  return {
    id: coverage.id,
    status: coverage.status,
    subscriberId: coverage.subscriberId ?? '',
    payorName: payorOrg?.name ?? '',
    payorId: getPayerId(payorOrg) ?? '',
    payorFhirId: payorOrg?.id ?? '',
    planType: getCoveragePlanType(coverage),
    relationship: coverage.relationship?.coding?.[0]?.display as BillingCoverageOption['relationship'],
    memberId: coverage.subscriberId ?? getMemberIdFromCoverage(coverage) ?? '',
    policyHolder: extractPolicyHolder(
      subscribers.find((sub) => sub.id === coverage.subscriber?.reference?.replace('RelatedPerson/', ''))
    ),
  };
}
