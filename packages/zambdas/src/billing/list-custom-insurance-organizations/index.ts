import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import {
  CUSTOM_INSURANCE_ORG_KIND_CODE,
  ListCustomInsuranceOrganizationsResponse,
} from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { NIO_ORGANIZATION_KIND_SYSTEM } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { fetchAllPages } from '../../shared/fhir';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { mapClinicalCustomInsuranceOrgOption } from '../custom-insurance-org.helpers';
import { createBillingClient } from '../shared';
import { ListCustomInsuranceOrganizationsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'list-custom-insurance-organizations';

const PAGE_SIZE = 1000;

// The clinical app's one door to billing-owned custom insurance organization data. Clinical code
// never reads billing FHIR directly: EHR/Intake frontends execute this zambda (via
// get-all-insurance-payers) with user tokens, and clinical zambdas invoke it over the wire — the
// same door pattern as list-non-insurance-organizations.
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

export async function performEffect(
  oystehr: Oystehr,
  params: ListCustomInsuranceOrganizationsParams
): Promise<ListCustomInsuranceOrganizationsResponse> {
  const searchParams: { name: string; value: string }[] = [
    { name: 'type', value: `${NIO_ORGANIZATION_KIND_SYSTEM}|${CUSTOM_INSURANCE_ORG_KIND_CODE}` },
    { name: '_sort', value: 'name' },
  ];
  if (params.insuranceOrgId) {
    // Lookups by id resolve deleted orgs too (active=false in the response), so a stored reference
    // stays displayable and clinical validation can tell active from retired.
    searchParams.push({ name: '_id', value: params.insuranceOrgId });
  } else {
    searchParams.push({ name: 'active', value: 'true' });
  }
  if (params.search) {
    searchParams.push({ name: 'name', value: params.search });
  }

  const orgs: Organization[] = [];
  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [...searchParams, { name: '_offset', value: String(offset) }, { name: '_count', value: String(count) }],
    });
    orgs.push(...bundle.unbundle());
    return bundle;
  }, PAGE_SIZE);

  return { organizations: orgs.map(mapClinicalCustomInsuranceOrgOption) };
}
