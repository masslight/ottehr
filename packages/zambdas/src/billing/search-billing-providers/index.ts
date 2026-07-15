import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization, Practitioner } from 'fhir/r4b';
import { BillingProviderOption, FHIR_IDENTIFIER_CODE_TAXONOMY, getNPI, getTaxID } from 'utils';
import { checkOrCreateM2MClientToken, fetchAllPages, wrapHandler, ZambdaInput } from '../../shared';
import {
  BILLING_WORKING_COPY_TAG,
  createBillingClient,
  EXCLUDE_WORKING_COPIES_PARAMS,
  fhirName,
  formatAddress,
  getTag,
  hasTag,
  LICENSE_TAG,
  PROVIDER_ROLE_BILLING,
  PROVIDER_ROLE_RENDERING,
  PROVIDER_ROLE_TAG,
  STRIPE_ACCOUNT_IDENTIFIER_SYSTEM,
  toAddressParts,
} from '../shared';
import { SearchBillingProvidersParams, validateRequestParameters } from './validateRequestParameters';

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
): Promise<{ providers: BillingProviderOption[]; total: number; offset: number; pageSize: number }> {
  const pageSize = params.pageSize ?? 50;
  const offset = params.offset ?? 0;

  // Role is a meta.tag (one system, code per role), independent of resource type: a provider
  // (Practitioner or Organization) can bill and/or render.
  const roleCode = params.providerType === 'rendering' ? PROVIDER_ROLE_RENDERING : PROVIDER_ROLE_BILLING;
  const baseParams: { name: string; value: string }[] = [
    { name: '_tag', value: `${PROVIDER_ROLE_TAG}|${roleCode}` },
    ...EXCLUDE_WORKING_COPIES_PARAMS,
  ];
  if (params.providerId) baseParams.push({ name: '_id', value: params.providerId });
  if (params.name) baseParams.push({ name: 'name', value: params.name });

  // FHIR paginates per resource type, so to return one sorted, paginated list across both we fetch
  // all matches and sort/paginate in memory. Provider counts are small; the two fetches run in parallel.
  const practitioners: Practitioner[] = [];
  const organizations: Organization[] = [];
  await Promise.all([
    fetchAllPages(async (o, count) => {
      const bundle = await oystehr.fhir.search<Practitioner>({
        resourceType: 'Practitioner',
        params: [...baseParams, { name: '_count', value: String(count) }, { name: '_offset', value: String(o) }],
      });
      practitioners.push(...bundle.unbundle());
      return bundle;
    }, 100),
    fetchAllPages(async (o, count) => {
      const bundle = await oystehr.fhir.search<Organization>({
        resourceType: 'Organization',
        params: [...baseParams, { name: '_count', value: String(count) }, { name: '_offset', value: String(o) }],
      });
      organizations.push(...bundle.unbundle());
      return bundle;
    }, 100),
  ]);

  const all = [...practitioners, ...organizations].map(mapProvider).sort((a, b) => a.name.localeCompare(b.name));
  return { providers: all.slice(offset, offset + pageSize), total: all.length, offset, pageSize };
}

function mapProvider(resource: Practitioner | Organization): BillingProviderOption {
  const addr = resource.address?.[0];
  const common = {
    id: resource.id ?? '',
    npi: getNPI(resource) ?? '',
    taxonomyCode:
      resource.identifier?.find((id) => id.type?.coding?.some((c) => c.code === FHIR_IDENTIFIER_CODE_TAXONOMY))
        ?.value ?? '',
    licenseType: getTag(resource, LICENSE_TAG),
    taxId: getTaxID(resource) ?? '',
    address: formatAddress(addr),
    addressParts: toAddressParts(addr),
    renders: hasTag(resource, PROVIDER_ROLE_TAG, PROVIDER_ROLE_RENDERING),
    bills: hasTag(resource, PROVIDER_ROLE_TAG, PROVIDER_ROLE_BILLING),
    isWorkingCopy: hasTag(resource, BILLING_WORKING_COPY_TAG.system, BILLING_WORKING_COPY_TAG.code),
  };
  if (resource.resourceType === 'Practitioner') {
    return {
      ...common,
      kind: 'individual',
      name: fhirName(resource),
      firstName: resource.name?.[0]?.given?.join(' ') ?? '',
      lastName: resource.name?.[0]?.family ?? '',
    };
  }
  return {
    ...common,
    kind: 'organization',
    name: resource.name ?? '',
    stripeAccountId: resource.identifier?.find((id) => id.system === STRIPE_ACCOUNT_IDENTIFIER_SYSTEM)?.value ?? '',
  };
}
