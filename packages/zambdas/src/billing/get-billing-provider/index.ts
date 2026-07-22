import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization, Practitioner } from 'fhir/r4b';
import { BillingProviderOption, FHIR_RESOURCE_NOT_FOUND_CUSTOM } from 'utils';
import { checkOrCreateM2MClientToken, fetchAllPages, wrapHandler, ZambdaInput } from '../../shared';
import {
  createBillingClient,
  EXCLUDE_WORKING_COPIES_PARAMS,
  mapProvider,
  PROVIDER_ROLE_BILLING,
  PROVIDER_ROLE_RENDERING,
  PROVIDER_ROLE_TAG,
} from '../shared';
import { GetBillingProviderParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-provider';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: GetBillingProviderParams): Promise<BillingProviderOption> {
  // Role is a meta.tag (one system, code per role), independent of resource type: a provider
  // (Practitioner or Organization) can bill and/or render.
  const roleCode = params.providerType === 'rendering' ? PROVIDER_ROLE_RENDERING : PROVIDER_ROLE_BILLING;
  const baseParams: { name: string; value: string }[] = [
    { name: '_tag', value: `${PROVIDER_ROLE_TAG}|${roleCode}`, ...EXCLUDE_WORKING_COPIES_PARAMS },
  ];
  baseParams.push({ name: '_id', value: params.providerId });

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
  if (!all.length) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM('Could not find billing provider');
  }
  return all[0];
}
