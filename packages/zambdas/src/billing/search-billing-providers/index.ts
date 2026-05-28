import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization, Practitioner } from 'fhir/r4b';
import { FHIR_IDENTIFIER_NPI, getNPI, getTaxID } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAMS, fhirName, formatAddress } from '../shared';
import { SearchBillingProvidersParams, validateRequestParameters } from './validateRequestParameters';

interface ProviderItem {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  npi: string;
  taxonomyCode?: string;
  taxId?: string;
  clia?: string;
  address?: string;
}

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-providers';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingProvidersParams
): Promise<{ providers: ProviderItem[]; total: number; offset: number; pageSize: number }> {
  const pageSize = params.pageSize ?? 50;
  const offset = params.offset ?? 0;

  const searchParams: { name: string; value: string }[] = [
    { name: '_sort', value: 'name' },
    { name: '_count', value: String(pageSize) },
    { name: '_offset', value: String(offset) },
  ];
  if (!params.includeWorkingCopies) searchParams.push(...EXCLUDE_WORKING_COPIES_PARAMS);
  if (params.providerId) searchParams.push({ name: '_id', value: params.providerId });
  if (params.name) searchParams.push({ name: 'name', value: params.name });

  // TODO: rendering providers may need to support Organization in addition to Practitioner
  if (params.providerType === 'rendering') {
    const bundle = await oystehr.fhir.search<Practitioner>({ resourceType: 'Practitioner', params: searchParams });
    const items = bundle.unbundle().map(mapPractitioner);
    return { providers: items, total: bundle.total ?? 0, offset, pageSize };
  }

  searchParams.push({ name: 'identifier', value: `${FHIR_IDENTIFIER_NPI}|` });
  const bundle = await oystehr.fhir.search<Organization>({ resourceType: 'Organization', params: searchParams });
  const items = bundle.unbundle().map(mapOrganization);
  return { providers: items, total: bundle.total ?? 0, offset, pageSize };
}

function mapPractitioner(p: Practitioner): ProviderItem {
  return {
    id: p.id ?? '',
    name: fhirName(p),
    firstName: p.name?.[0]?.given?.join(' ') ?? '',
    lastName: p.name?.[0]?.family ?? '',
    npi: getNPI(p) ?? '',
    taxonomyCode: p.qualification?.[0]?.code?.coding?.[0]?.code ?? '',
  };
}

function mapOrganization(o: Organization): ProviderItem {
  return {
    id: o.id ?? '',
    name: o.name ?? '',
    npi: getNPI(o) ?? '',
    taxId: getTaxID(o) ?? '',
    // TODO: need to define and store CLIA
    clia: '',
    address: formatAddress(o.address?.[0]),
  };
}
