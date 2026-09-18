import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import {
  CUSTOM_INSURANCE_ORG_ID_PREFIX,
  CUSTOM_INSURANCE_ORG_ID_SYSTEM,
  CUSTOM_INSURANCE_ORG_KIND_CODE,
  SearchCustomInsuranceOrgsResponse,
} from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { NIO_ORGANIZATION_KIND_SYSTEM } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { isCustomInsuranceOrgBusinessId, mapCustomInsuranceOrganization } from '../custom-insurance-org.helpers';
import { createBillingClient } from '../shared';
import { SearchInsuranceOrgsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-custom-insurance-orgs';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect(oystehr, params);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

// Serves both the list page (paginated) and the detail page (insuranceOrgId filter).
export async function performEffect(
  oystehr: Oystehr,
  params: SearchInsuranceOrgsParams
): Promise<SearchCustomInsuranceOrgsResponse> {
  const pageSize = params.pageSize ?? 50;
  const offset = params.offset ?? 0;

  const searchParams: { name: string; value: string }[] = [
    { name: 'type', value: `${NIO_ORGANIZATION_KIND_SYSTEM}|${CUSTOM_INSURANCE_ORG_KIND_CODE}` },
    { name: '_sort', value: 'name' },
    { name: '_count', value: String(pageSize) },
    { name: '_offset', value: String(offset) },
    { name: '_total', value: 'accurate' },
  ];
  // A typed query in the shape of a custom org's business id ("OTR-...") is an id lookup, not a name
  // search — every business id has this prefix, so a name search would never have matched it anyway.
  const businessId = params.name?.trim();
  const isBusinessIdSearch = !!businessId && isCustomInsuranceOrgBusinessId(businessId);
  // The prefix is always uppercase; normalize a lowercase-typed prefix without touching the
  // user-entered suffix, whose case may matter for the exact identifier match.
  const normalizedBusinessId =
    isBusinessIdSearch && businessId
      ? CUSTOM_INSURANCE_ORG_ID_PREFIX + businessId.slice(CUSTOM_INSURANCE_ORG_ID_PREFIX.length)
      : businessId;
  if (params.insuranceOrgId) {
    searchParams.push({ name: '_id', value: params.insuranceOrgId });
  } else {
    searchParams.push({ name: 'active', value: 'true' });
    if (isBusinessIdSearch) {
      searchParams.push({ name: 'identifier', value: `${CUSTOM_INSURANCE_ORG_ID_SYSTEM}|${normalizedBusinessId}` });
    } else if (params.name) {
      searchParams.push({ name: 'name', value: params.name });
    }
  }

  const bundle = await oystehr.fhir.search<Organization>({
    resourceType: 'Organization',
    params: searchParams,
  });

  const organizations = bundle.unbundle().map(mapCustomInsuranceOrganization);

  return {
    organizations,
    total: bundle.total ?? 0,
    offset,
    pageSize,
  };
}
