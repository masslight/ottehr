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
import { mapNonInsuranceOrganization, referencedId, resolvePayerOptionsByRef } from '../non-insurance-org.helpers';
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

  const orgBundle = await oystehr.fhir.search<Organization>({
    resourceType: 'Organization',
    params: searchParams,
  });
  const orgs = orgBundle.unbundle();

  // One affiliation search covers the whole page; categories live on affiliation.code and the
  // coverage orgs ride along via _include.
  const affiliationsByNioId = new Map<string, OrganizationAffiliation[]>();
  const coverageOrgsById = new Map<string, Organization>();
  if (orgs.length > 0) {
    const affiliationBundle = await oystehr.fhir.search<Organization | OrganizationAffiliation>({
      resourceType: 'OrganizationAffiliation',
      params: [
        { name: 'primary-organization', value: orgs.map((org) => `Organization/${org.id}`).join(',') },
        { name: 'active', value: 'true' },
        { name: '_include', value: 'OrganizationAffiliation:participating-organization' },
        { name: '_count', value: '1000' },
      ],
    });
    for (const resource of affiliationBundle.unbundle()) {
      if (resource.resourceType === 'Organization') {
        if (resource.id) coverageOrgsById.set(resource.id, resource);
        continue;
      }
      const nioId = referencedId(resource.organization);
      if (!nioId) continue;
      affiliationsByNioId.set(nioId, [...(affiliationsByNioId.get(nioId) ?? []), resource]);
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
