import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Resource } from 'fhir/r4b';
import { isResponseSizeExceededError } from 'utils/lib/fhir/responseSize';
import { CLAIM_SCAN_MATCH_LIMIT } from 'utils/lib/types/data/billing/billing.constants';
import { SearchBillingClaimsResponse } from 'utils/lib/types/data/billing/billing.types';
import { CLAIM_SEARCH_TOO_BROAD_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import {
  buildClaimFilterParams,
  CLAIM_LIST_PARAMS,
  claimMatchesServiceDateRange,
  enrichAndMapClaims,
  fetchClaimsPageByIds,
  scanClaimIds,
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

  const response = await performEffectHandlingResponseSize(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// A page the server refuses to serialize has already been retried at a smaller size by the time it
// gets here. The remaining lever is the caller's: the unfiltered branch's page size is the caller's
// pageSize, and shrinking that here would break the offset arithmetic the list paginates on — so
// say what the biller can change rather than surfacing a raw SDK error.
async function performEffectHandlingResponseSize(
  oystehr: Oystehr,
  params: SearchBillingClaimsParams
): Promise<SearchBillingClaimsResponse> {
  try {
    return await performEffect(oystehr, params);
  } catch (error) {
    if (isResponseSizeExceededError(error)) {
      console.error('Claim search exceeded the FHIR response size limit:', error);
      throw CLAIM_SEARCH_TOO_BROAD_ERROR;
    }
    throw error;
  }
}

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

  // Neither a search text nor a service date can be paginated by the server: FHIR ANDs separate
  // search parameters and only ORs within one, so searching several fields at once means several
  // searches whose union only exists here (_filter would express it as one paginated search, but
  // Oystehr discards _filter), and Claim has no service-date search parameter at all. Both
  // therefore scan for matching ids, page in memory, and hydrate only the page they settle on.
  if (params.searchText || filteringByServiceDate) {
    const matched = params.searchText
      ? await searchClaimsBySearchText({
          oystehr,
          searchText: params.searchText,
          filterParams,
          withServiceDateElements: filteringByServiceDate,
          patientNameOnly: params.patientNameOnly,
        })
      : await scanClaimIds({
          oystehr,
          params: filterParams,
          maxMatches: CLAIM_SCAN_MATCH_LIMIT,
          withServiceDate: true,
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
  } else {
    const bundle = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        ...CLAIM_LIST_PARAMS,
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
