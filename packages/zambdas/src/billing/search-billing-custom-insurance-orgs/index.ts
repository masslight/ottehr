import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import {
  CUSTOM_INSURANCE_ORG_KIND_CODE,
  SearchCustomInsuranceOrgsResponse,
} from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { NIO_ORGANIZATION_KIND_SYSTEM } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { mapCustomInsuranceOrganization } from '../custom-insurance-org.helpers';
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
  if (params.insuranceOrgId) {
    searchParams.push({ name: '_id', value: params.insuranceOrgId });
  } else {
    searchParams.push({ name: 'active', value: 'true' });
  }
  if (params.name) {
    searchParams.push({ name: 'name', value: params.name });
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
