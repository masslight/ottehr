import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { getNPI } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAM } from '../shared';

interface ServiceLocationItem {
  id: string;
  name: string;
  npi: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  status: 'active' | 'inactive';
}

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-service-locations';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createBillingClient(m2mToken, input.secrets);

  const response = await performEffect(oystehr);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr): Promise<{ locations: ServiceLocationItem[] }> {
  const result = await oystehr.fhir.search<Location>({
    resourceType: 'Location',
    params: [{ name: '_sort', value: 'name' }, { name: '_count', value: '200' }, EXCLUDE_WORKING_COPIES_PARAM],
  });

  const locations = result.unbundle().map(mapLocation);
  return { locations };
}

function mapLocation(loc: Location): ServiceLocationItem {
  const phone = loc.telecom?.find((t) => t.system === 'phone');
  const addr = loc.address;

  return {
    id: loc.id ?? '',
    name: loc.name ?? '',
    npi: getNPI(loc) ?? '',
    address: addr?.line?.join(', ') ?? '',
    city: addr?.city ?? '',
    state: addr?.state ?? '',
    postalCode: addr?.postalCode ?? '',
    phone: phone?.value ?? '',
    status: loc.status === 'active' ? 'active' : 'inactive',
  };
}
