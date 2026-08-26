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
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { getNioCoverageCategory, mapClinicalNioOption, referencedId } from '../non-insurance-org.helpers';
import { createBillingClient } from '../shared';
import { ListNonInsuranceOrganizationsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'list-non-insurance-organizations';

// The clinical app's one door to billing-owned NIO data. Clinical code never reads billing FHIR:
// EHR frontends execute this zambda with user tokens, and clinical zambdas invoke it over the
// wire. The response is the deliberately minimal ClinicalNioOption — no payer refs, no submission
// details, no contacts — whose `reference` field is the NIO token clinical code stores verbatim.
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
    { name: '_count', value: '1000' },
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

  const orgs = (
    await oystehr.fhir.search<Organization>({ resourceType: 'Organization', params: searchParams })
  ).unbundle();

  // Coverage categories live on OrganizationAffiliation.code, so this never touches coverage orgs.
  const categoriesByNioId = new Map<string, Set<NioCoverageCategory>>();
  if (orgs.length > 0) {
    const affiliations = (
      await oystehr.fhir.search<OrganizationAffiliation>({
        resourceType: 'OrganizationAffiliation',
        params: [
          { name: 'primary-organization', value: orgs.map((org) => `Organization/${org.id}`).join(',') },
          { name: 'active', value: 'true' },
          { name: '_count', value: '1000' },
        ],
      })
    ).unbundle();
    for (const affiliation of affiliations) {
      const nioId = referencedId(affiliation.organization);
      const category = getNioCoverageCategory(affiliation.code);
      if (!nioId || !category) continue;
      const set = categoriesByNioId.get(nioId) ?? new Set<NioCoverageCategory>();
      set.add(category);
      categoriesByNioId.set(nioId, set);
    }
  }

  const organizations = orgs.map((org) => {
    const categories = [...(categoriesByNioId.get(org.id ?? '') ?? [])].sort(
      (a, b) => NIO_COVERAGE_CATEGORIES.indexOf(a) - NIO_COVERAGE_CATEGORIES.indexOf(b)
    );
    return mapClinicalNioOption(org, categories);
  });

  return { organizations };
}
