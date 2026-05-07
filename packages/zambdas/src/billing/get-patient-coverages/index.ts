import { APIGatewayProxyResult } from 'aws-lambda';
import { Coverage, Organization } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAM, getPayerId } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-patient-coverages';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { patientId } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createBillingClient(m2mToken, input.secrets);

    const response = await oystehr.fhir.search<Coverage | Organization>({
      resourceType: 'Coverage',
      params: [
        { name: 'beneficiary', value: `Patient/${patientId}` },
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
        payorId: payorOrg ? getPayerId(payorOrg) : '',
        payorFhirId: payorOrg?.id ?? '',
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ coverages: result }),
    };
  } catch (error: unknown) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});
