import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization, OrganizationAffiliation } from 'fhir/r4b';
import { NIO_COVERAGE_CATEGORIES, NioCoverageCategory } from 'utils/lib/types/data/billing/non-insurance-org.schemas';
import {
  ListNonInsuranceOrganizationsResponse,
  NIO_EMPLOYER_KIND_CODE,
  NIO_KIND_CODE,
  NIO_ORGANIZATION_KIND_SYSTEM,
} from 'utils/lib/types/data/billing/non-insurance-org.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { fetchAllPages } from '../../shared/fhir';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { getNioCoverageCategory, mapClinicalNioOption, referencedId } from '../non-insurance-org.helpers';
import { createBillingClient } from '../shared';
import { ListNonInsuranceOrganizationsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'list-non-insurance-organizations';

const PAGE_SIZE = 1000;

// The clinical app's one door to billing-owned NIO data. Clinical code never reads billing FHIR:
// EHR frontends execute this zambda with user tokens, and clinical zambdas invoke it over the
// wire.
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
  params: ListNonInsuranceOrganizationsParams
): Promise<ListNonInsuranceOrganizationsResponse> {
  const searchParams: { name: string; value: string }[] = [
    { name: 'type', value: `${NIO_ORGANIZATION_KIND_SYSTEM}|${NIO_KIND_CODE}` },
    { name: '_sort', value: 'name' },
  ];
  if (params.nioId) {
    // Lookups by id resolve deleted NIOs too (active=false in the response), so stored references
    // stay displayable and clinical validation can tell active from retired.
    searchParams.push({ name: '_id', value: params.nioId });
  } else {
    searchParams.push({ name: 'active', value: 'true' });
  }
  if (params.employerOnly) {
    searchParams.push({ name: 'type', value: `${NIO_ORGANIZATION_KIND_SYSTEM}|${NIO_EMPLOYER_KIND_CODE}` });
  }
  if (params.search) {
    searchParams.push({ name: 'name', value: params.search });
  }

  // One round trip per page: affiliations ride along via _revinclude (their coverage orgs are
  // never needed here — categories live on affiliation.code). _revinclude can't filter, so
  // inactive pairs are dropped in code below.
  searchParams.push({ name: '_revinclude', value: 'OrganizationAffiliation:primary-organization' });

  const orgs: Organization[] = [];
  const categoriesByNioId = new Map<string, Set<NioCoverageCategory>>();
  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<Organization | OrganizationAffiliation>({
      resourceType: 'Organization',
      params: [...searchParams, { name: '_offset', value: String(offset) }, { name: '_count', value: String(count) }],
    });
    for (const resource of bundle.unbundle()) {
      if (resource.resourceType === 'Organization') {
        orgs.push(resource);
        continue;
      }
      if (resource.active === false) continue;
      const nioId = referencedId(resource.organization);
      const category = getNioCoverageCategory(resource.code);
      if (!nioId || !category) continue;
      const set = categoriesByNioId.get(nioId) ?? new Set<NioCoverageCategory>();
      set.add(category);
      categoriesByNioId.set(nioId, set);
    }
    return bundle;
  }, PAGE_SIZE);

  const organizations = orgs.map((org) => {
    const categories = [...(categoriesByNioId.get(org.id ?? '') ?? [])].sort(
      (a, b) => NIO_COVERAGE_CATEGORIES.indexOf(a) - NIO_COVERAGE_CATEGORIES.indexOf(b)
    );
    return mapClinicalNioOption(org, categories);
  });

  return { organizations };
}
