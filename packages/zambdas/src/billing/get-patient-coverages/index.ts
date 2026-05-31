import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coverage } from 'fhir/r4b';
import { BillingCoverageOption, getPayerId } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAMS, resolvePayersByRef } from '../shared';
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

async function performEffect(
  oystehr: Oystehr,
  params: GetPatientCoveragesParams
): Promise<{ coverages: BillingCoverageOption[] }> {
  const response = await oystehr.fhir.search<Coverage>({
    resourceType: 'Coverage',
    params: [{ name: 'beneficiary', value: `Patient/${params.patientId}` }, ...EXCLUDE_WORKING_COPIES_PARAMS],
  });

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
    };
  });

  return { coverages: result };
}
