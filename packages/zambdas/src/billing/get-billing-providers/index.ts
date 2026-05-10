import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization, Practitioner } from 'fhir/r4b';
import { convertFhirNameToDisplayName, getNPI, getSecret, getTaxID, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import {
  BILLS_TAG,
  createBillingClient,
  EXCLUDE_WORKING_COPIES_PARAM,
  getTag,
  hasNpiIdentifier,
  LICENSE_TAG,
  RENDERS_TAG,
} from '../shared';
import { GetBillingProvidersParams, validateRequestParameters } from './validateRequestParameters';

interface ProviderItem {
  id: string;
  name: string;
  npi: string;
  providerType: 'Individual' | 'Organization';
  rendersServices: boolean;
  billsServices: boolean;
  licenseType: string;
  taxId: string;
  addressLine?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-providers';

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
  params: GetBillingProvidersParams
): Promise<{ providers: ProviderItem[] }> {
  const fetchRendering = params.providerType !== 'billing';
  const fetchBilling = params.providerType !== 'rendering';
  const searchParams = [
    { name: '_sort', value: 'name' },
    { name: '_count', value: '200' },
    EXCLUDE_WORKING_COPIES_PARAM,
  ];

  const providers: ProviderItem[] = [];

  if (fetchRendering) {
    const result = await oystehr.fhir.search<Practitioner>({ resourceType: 'Practitioner', params: searchParams });
    providers.push(...result.unbundle().map(mapPractitioner));
  }
  if (fetchBilling) {
    const result = await oystehr.fhir.search<Organization>({ resourceType: 'Organization', params: searchParams });
    providers.push(...result.unbundle().filter(hasNpiIdentifier).map(mapOrganization));
  }

  return { providers };
}

function mapPractitioner(p: Practitioner): ProviderItem {
  const name = p.name?.[0];
  return {
    id: p.id ?? '',
    name: name ? convertFhirNameToDisplayName(name) : '',
    npi: getNPI(p) ?? '',
    providerType: 'Individual',
    rendersServices: getTag(p, RENDERS_TAG) !== 'false',
    billsServices: getTag(p, BILLS_TAG) === 'true',
    licenseType: getTag(p, LICENSE_TAG) ?? p.qualification?.[0]?.code?.coding?.[0]?.code ?? '',
    taxId: getTaxID(p) ?? '',
  };
}

function mapOrganization(o: Organization): ProviderItem {
  const addr = o.address?.[0];
  return {
    id: o.id ?? '',
    name: o.name ?? '',
    npi: getNPI(o) ?? '',
    providerType: 'Organization',
    rendersServices: getTag(o, RENDERS_TAG) !== 'false',
    billsServices: getTag(o, BILLS_TAG) === 'true',
    licenseType: getTag(o, LICENSE_TAG) ?? '',
    taxId: getTaxID(o) ?? '',
    addressLine: addr?.line?.join(', ') ?? '',
    city: addr?.city ?? '',
    state: addr?.state ?? '',
    postalCode: addr?.postalCode ?? '',
  };
}
