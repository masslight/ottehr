import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { getNPI } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAMS, formatAddress } from '../shared';
import { SearchBillingLocationsParams, validateRequestParameters } from './validateRequestParameters';

interface LocationSearchItem {
  id: string | undefined;
  name: string;
  npi: string;
  address: string;
}

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-locations';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingLocationsParams
): Promise<{ locations: LocationSearchItem[] }> {
  // TODO: add pagination support
  const searchParams: { name: string; value: string }[] = [
    { name: '_count', value: '50' },
    { name: '_sort', value: 'name' },
  ];
  if (!params.includeWorkingCopies) searchParams.push(...EXCLUDE_WORKING_COPIES_PARAMS);
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
