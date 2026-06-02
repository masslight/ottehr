import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import { BillingOrganizationOption, getNPI, getPayerId, getTaxID } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAMS } from '../shared';
import { SearchBillingOrganizationsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-organizations';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingOrganizationsParams
): Promise<{ organizations: BillingOrganizationOption[] }> {
  if (params.type === 'pay') {
    const result = await oystehr.rcm.listPayers({ ...(params.name ? { name: params.name } : {}), limit: 50 });
    const organizations = result.data.map((o) => ({
      id: o.id,
      name: o.name ?? '',
      npi: getNPI(o) ?? '',
      tin: getTaxID(o) ?? '',
      payerId: getPayerId(o) ?? '',
      isPayer: true,
    }));
    return { organizations };
  }

  // TODO: add pagination support
  const searchParams: { name: string; value: string }[] = [
    { name: '_count', value: '50' },
    { name: '_sort', value: 'name' },
  ];
  if (!params.includeWorkingCopies) searchParams.push(...EXCLUDE_WORKING_COPIES_PARAMS);
  if (params.name) searchParams.push({ name: 'name', value: params.name });
  if (params.type) searchParams.push({ name: 'type', value: params.type });

  const response = await oystehr.fhir.search<Organization>({ resourceType: 'Organization', params: searchParams });

  const organizations = response.unbundle().map((o) => {
    const isPayer = o.type?.some((t) => t.coding?.some((c) => c.code === 'pay'));
    return {
      id: o.id,
      name: o.name ?? '',
      npi: getNPI(o) ?? '',
      tin: getTaxID(o) ?? '',
      payerId: getPayerId(o) ?? '',
      isPayer,
    };
  });

  return { organizations };
}
