import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization, OrganizationAffiliation } from 'fhir/r4b';
import { SearchNonInsuranceOrgsResponse } from 'utils/lib/types/data/billing/non-insurance-org.types';
import {
  NIO_EMPLOYER_KIND_CODE,
  NIO_KIND_CODE,
  NIO_ORGANIZATION_KIND_SYSTEM,
} from 'utils/lib/types/data/billing/non-insurance-org.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import {
  isNonInsuranceOrganization,
  mapNonInsuranceOrganization,
  referencedId,
  resolvePayerOptionsByRef,
} from '../non-insurance-org.helpers';
import { createBillingClient } from '../shared';
import { SearchNonInsuranceOrgsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-non-insurance-orgs';

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

// Serves both the list page (paginated) and the detail page (nioId filter); rows come back as
// full DTOs — contacts and covers included — so both views share one shape.
export async function performEffect(
  oystehr: Oystehr,
  params: SearchNonInsuranceOrgsParams
): Promise<SearchNonInsuranceOrgsResponse> {
  const pageSize = params.pageSize ?? 50;
  const offset = params.offset ?? 0;

  const searchParams: { name: string; value: string }[] = [
    { name: 'type', value: `${NIO_ORGANIZATION_KIND_SYSTEM}|${NIO_KIND_CODE}` },
    { name: '_sort', value: 'name' },
    { name: '_count', value: String(pageSize) },
    { name: '_offset', value: String(offset) },
    { name: '_total', value: 'accurate' },
    // One round trip: affiliations ride along via _revinclude and their coverage orgs via
    // _include:iterate. _revinclude can't filter, so inactive pairs are dropped in code below.
    { name: '_revinclude', value: 'OrganizationAffiliation:primary-organization' },
    { name: '_include:iterate', value: 'OrganizationAffiliation:participating-organization' },
  ];
  if (params.nioId) {
    searchParams.push({ name: '_id', value: params.nioId });
  } else {
    searchParams.push({ name: 'active', value: 'true' });
  }
  if (params.employer) {
    searchParams.push({ name: 'type', value: `${NIO_ORGANIZATION_KIND_SYSTEM}|${NIO_EMPLOYER_KIND_CODE}` });
  }
  if (params.name) {
    searchParams.push({ name: 'name', value: params.name });
  }

  const orgBundle = await oystehr.fhir.search<Organization | OrganizationAffiliation>({
    resourceType: 'Organization',
    params: searchParams,
  });

  const orgs: Organization[] = [];
  const affiliationsByNioId = new Map<string, OrganizationAffiliation[]>();
  const coverageOrgsById = new Map<string, Organization>();
  for (const resource of orgBundle.unbundle()) {
    if (resource.resourceType === 'OrganizationAffiliation') {
      if (resource.active === false) continue;
      const nioId = referencedId(resource.organization);
      if (!nioId) continue;
      affiliationsByNioId.set(nioId, [...(affiliationsByNioId.get(nioId) ?? []), resource]);
      continue;
    }
    // NIO rows and included coverage orgs are both Organizations; the kind coding tells them apart.
    if (isNonInsuranceOrganization(resource)) {
      orgs.push(resource);
    } else if (resource.id) {
      coverageOrgsById.set(resource.id, resource);
    }
  }

  const payerOptionsByRef = await resolvePayerOptionsByRef(oystehr, [...coverageOrgsById.values()]);

  const organizations = orgs.map((org) =>
    mapNonInsuranceOrganization({
      org,
      affiliations: affiliationsByNioId.get(org.id ?? '') ?? [],
      coverageOrgsById,
      payerOptionsByRef,
    })
  );

  return {
    organizations,
    total: orgBundle.total ?? 0,
    offset,
    pageSize,
  };
}
