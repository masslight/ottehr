import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Location, Organization, Patient, Practitioner, Resource } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { SearchBillingClaimsResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import {
  buildClaimFilterParams,
  CLAIM_LIST_INCLUDE_PARAMS,
  claimMatchesServiceDateRange,
  enrichAndMapClaims,
  fetchClaimsPageByIds,
  searchClaimsBySearchText,
} from '../claim-search';
import { createBillingClient } from '../shared';
import { SearchBillingClaimsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-claims';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingClaimsParams
): Promise<SearchBillingClaimsResponse> {
  const pageSize = params.pageSize ?? 25;
  const offset = params.offset ?? 0;

  const filterParams = await buildClaimFilterParams({
    oystehr,
    params,
  });

  const filteringByServiceDate = Boolean(params.serviceDateFrom || params.serviceDateTo);

  let pageClaims: Claim[];
  let includedResources: Resource[];
  let total: number;
  let incomplete = false;

  if (params.searchText) {
    // FHIR ANDs separate search parameters and only ORs within one, so searching several fields at
    // once means several searches, and their union can only be paginated here rather than by the
    // server. _filter would express it as one paginated search, but Oystehr discards _filter.
    const matched = await searchClaimsBySearchText({
      oystehr,
      searchText: params.searchText,
      filterParams,
      withServiceDateElements: filteringByServiceDate,
    });
    incomplete = matched.incomplete;
    const matching = filteringByServiceDate
      ? matched.claims.filter((c) => claimMatchesServiceDateRange(c, params.serviceDateFrom, params.serviceDateTo))
      : matched.claims;
    total = matching.length;
    const page = await fetchClaimsPageByIds({
      oystehr,
      claimIds: matching.slice(offset, offset + pageSize).map((c) => c.id),
    });
    pageClaims = page.claims;
    includedResources = page.includedResources;
  } else if (filteringByServiceDate) {
    includedResources = await getAllFhirSearchPages<Claim | Patient | Location | Practitioner | Organization>(
      {
        resourceType: 'Claim',
        params: [...CLAIM_LIST_INCLUDE_PARAMS, ...filterParams],
      },
      oystehr
    );
    const matching = includedResources
      .filter((r): r is Claim => r.resourceType === 'Claim')
      .filter((c) => claimMatchesServiceDateRange(c, params.serviceDateFrom, params.serviceDateTo));
    total = matching.length;
    pageClaims = matching.slice(offset, offset + pageSize);
  } else {
    const bundle = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        ...CLAIM_LIST_INCLUDE_PARAMS,
        ...filterParams,
        { name: '_count', value: String(pageSize) },
        { name: '_offset', value: String(offset) },
        { name: '_total', value: 'accurate' },
      ],
    });
    total = bundle.total ?? 0;
    includedResources = (bundle.entry ?? []).map((e) => e.resource).filter(Boolean) as Resource[];
    pageClaims = includedResources.filter((r) => r.resourceType === 'Claim') as Claim[];
  }

  const items = await enrichAndMapClaims({
    oystehr,
    claims: pageClaims,
    includedResources,
  });

  return {
    claims: items,
    total,
    offset,
    pageSize,
    incomplete,
  };
}
