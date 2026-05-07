import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner } from 'fhir/r4b';
import { convertFhirNameToDisplayName, getNPI, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAM } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-practitioners';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const params = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const searchParams: { name: string; value: string }[] = [
      { name: '_count', value: '50' },
      { name: '_sort', value: 'family' },
      EXCLUDE_WORKING_COPIES_PARAM,
    ];
    if (params.name) searchParams.push({ name: 'name', value: params.name });

    const response = await oystehr.fhir.search<Practitioner>({ resourceType: 'Practitioner', params: searchParams });

    const practitioners = response.unbundle().map((p) => {
      const name = p.name?.[0];
      return {
        id: p.id,
        name: name ? convertFhirNameToDisplayName(name) : '',
        firstName: name?.given?.join(' ') ?? '',
        lastName: name?.family ?? '',
        npi: getNPI(p) ?? '',
        taxonomy: p.identifier?.find((id) => id.type?.coding?.some((c) => c.code === 'ZZ'))?.value ?? '',
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ practitioners }),
    };
  } catch (error: unknown) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});
