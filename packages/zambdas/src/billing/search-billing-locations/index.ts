import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { getNPI, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAM, formatAddress } from '../shared';
import { SearchBillingLocationsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-locations';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const params = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const response = await performEffect(oystehr, params);
    return { statusCode: 200, body: JSON.stringify(response) };
  } catch (error: unknown) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingLocationsParams
): Promise<{ locations: unknown[] }> {
  const searchParams: { name: string; value: string }[] = [
    { name: '_count', value: '50' },
    { name: '_sort', value: 'name' },
    EXCLUDE_WORKING_COPIES_PARAM,
  ];
  if (params.name) searchParams.push({ name: 'name', value: params.name });

  const response = await oystehr.fhir.search<Location>({ resourceType: 'Location', params: searchParams });

  const locations = response.unbundle().map((l) => ({
    id: l.id,
    name: l.name ?? '',
    npi: getNPI(l) ?? '',
    address: formatAddress(l.address),
  }));

  return { locations };
}
