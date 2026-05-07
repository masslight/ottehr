import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { getNPI, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAM } from '../shared';

export interface ServiceLocationItem {
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
const ZAMBDA_NAME = 'get-billing-service-locations';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createBillingClient(m2mToken, input.secrets);

    const result = await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [{ name: '_sort', value: 'name' }, { name: '_count', value: '200' }, EXCLUDE_WORKING_COPIES_PARAM],
    });

    const locations = result.unbundle().map(mapLocation);

    return {
      statusCode: 200,
      body: JSON.stringify({ locations }),
    };
  } catch (error: unknown) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

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
