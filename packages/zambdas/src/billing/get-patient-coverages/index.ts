import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coverage, Organization } from 'fhir/r4b';
import { getPayerId } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAM } from '../shared';
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

// TODO: Coverage.payor will move to external Oystehr payer refs (#6603)
async function performEffect(oystehr: Oystehr, params: GetPatientCoveragesParams): Promise<{ coverages: unknown[] }> {
  const response = await oystehr.fhir.search<Coverage | Organization>({
    resourceType: 'Coverage',
    params: [
      { name: 'beneficiary', value: `Patient/${params.patientId}` },
      { name: '_include', value: 'Coverage:payor' },
      EXCLUDE_WORKING_COPIES_PARAM,
    ],
  });

  const resources = response.unbundle();
  const coverages = resources.filter((r): r is Coverage => r.resourceType === 'Coverage');
  const orgs = resources.filter((r): r is Organization => r.resourceType === 'Organization');

  const result = coverages.map((cov) => {
    const payorRef = cov.payor?.[0]?.reference;
    const payorId = payorRef?.replace('Organization/', '');
    const payorOrg = orgs.find((o) => o.id === payorId);

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
