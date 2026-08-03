import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse, Coverage, Location, Organization, Patient, Practitioner, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BillingClaimItem,
  CLAIM_STATUS_TAG_SYSTEMS,
  CLAIM_TAG_SYSTEM,
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM,
  deduplicateUnbundledResources,
  getAllFhirSearchPages,
  getClaimStatusValues,
  getPayerId,
  getPayerUrl,
  isValidUUID,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { fetchClaimResponsesByClaimIds, fetchPatientPaidByClaimId, summarizeClaimPayments } from '../claim-amounts';
import {
  CLAIM_PCN_IDENTIFIER_SYSTEM,
  claimIdFromPcn,
  ClaimSearchParam,
  createBillingClient,
  CURRENT_STATUS_TAG_SYSTEM,
  determineRulesEngineForClaim,
  fhirName,
  findRef,
  getClaimService,
  getClaimStatus,
  getClaimType,
  patientSearchParam,
  resolveLinkedPatientIds,
  resolvePayersByRef,
  resourceDisplayName,
  sortClaimInsurance,
} from '../shared';
import { SearchBillingClaimsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-claims';

export const CLAIM_LIST_INCLUDE_PARAMS: ClaimSearchParam[] = [
  {
    name: '_include',
    value: 'Claim:patient',
  },
  {
    name: '_include',
    value: 'Claim:facility',
  },
  {
    name: '_include',
    value: 'Claim:care-team',
  },
  {
    name: '_include',
    value: 'Claim:provider',
  },
];

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
): Promise<{ claims: BillingClaimItem[]; total: number; offset: number; pageSize: number }> {
  const pageSize = params.pageSize ?? 25;
  const offset = params.offset ?? 0;

  // Resolve the payer filter to Oystehr payer list URLs
  let insurerFilter: string | undefined;
  if (params.payerId) {
    insurerFilter = getPayerUrl(params.payerId);
  } else if (params.payerName) {
    const result = await oystehr.rcm.listPayers({ name: params.payerName, limit: 50 });
    const payerIds = result.data.map((p) => getPayerId(p)).filter(Boolean) as string[];
    if (payerIds.length === 0) return { claims: [], total: 0, offset, pageSize };
    insurerFilter = payerIds.map((id) => getPayerUrl(id)).join(',');
  }

  const filterParams: ClaimSearchParam[] = [
    {
      name: '_sort',
      value: '-_lastUpdated',
    },
  ];

  if (params.type) filterParams.push({ name: '_tag', value: `${CODE_SYSTEM_CLAIM_TYPE}|${params.type}` });
  if (params.status) filterParams.push({ name: '_tag', value: `${CURRENT_STATUS_TAG_SYSTEM}|${params.status}` });
  if (params.arStage)
    filterParams.push({ name: '_tag', value: `${CLAIM_STATUS_TAG_SYSTEMS.arStage}|${params.arStage}` });
  if (params.createdFrom) filterParams.push({ name: 'created', value: `ge${params.createdFrom}` });
  if (params.createdTo) filterParams.push({ name: 'created', value: `le${params.createdTo}` });
  if (params.patientId)
    filterParams.push(
      patientSearchParam(
        await resolveLinkedPatientIds({
          oystehr,
          patientId: params.patientId,
        })
      )
    );
  if (params.service)
    filterParams.push({ name: '_tag', value: `${CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM}|${params.service}` });
  if (insurerFilter) filterParams.push({ name: 'insurer', value: insurerFilter });
  if (params.tag) filterParams.push({ name: '_tag', value: `${CLAIM_TAG_SYSTEM}|${params.tag}` });

  const filteringByServiceDate = Boolean(params.serviceDateFrom || params.serviceDateTo);

  let pageClaims: Claim[];
  let includedResources: Resource[];
  let total: number;

  if (params.searchText) {
    const matched = await searchClaimsBySearchText({
      oystehr,
      searchText: params.searchText,
      filterParams,
      withServiceDateElements: filteringByServiceDate,
    });
    const matching = filteringByServiceDate
      ? matched.filter((c) => claimMatchesServiceDateRange(c, params.serviceDateFrom, params.serviceDateTo))
      : matched;
    total = matching.length;
    const page = await fetchClaimsPageByIds({
      oystehr,
      claimIds: matching
        .slice(offset, offset + pageSize)
        .map((c) => c.id)
        .filter(Boolean) as string[],
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

  const patients = includedResources.filter((r) => r.resourceType === 'Patient') as Patient[];
  const locations = includedResources.filter((r) => r.resourceType === 'Location') as Location[];
  const providers = includedResources.filter(
    (r): r is Practitioner | Organization => r.resourceType === 'Practitioner' || r.resourceType === 'Organization'
  );

  const items = await enrichAndMapClaims(oystehr, pageClaims, {
    patients,
    locations,
    providers,
  });

  return {
    claims: items,
    total,
    offset,
    pageSize,
  };
}

export const getClaimServiceDate = (claim: Claim): string =>
  claim.item?.[0]?.servicedPeriod?.start ?? claim.item?.[0]?.servicedDate ?? claim.created ?? '';

const toServiceDay = (value?: string): string | null =>
  value ? DateTime.fromISO(value, { setZone: true }).toISODate() : null;

export const claimMatchesServiceDateRange = (claim: Claim, from?: string, to?: string): boolean => {
  const day = toServiceDay(getClaimServiceDate(claim));
  if (!day) return false;
  const fromDay = toServiceDay(from);
  const toDay = toServiceDay(to);
  if (fromDay && day < fromDay) return false;
  if (toDay && day > toDay) return false;
  return true;
};

export const CLAIM_SEARCH_TEXT_MATCH_LIMIT = 200;
export const CLAIM_SEARCH_TEXT_CONCURRENCY = 4;

export function buildClaimSearchTextQueries({
  searchText,
  patientIds = [],
}: {
  searchText: string;
  patientIds?: string[];
}): ClaimSearchParam[][] {
  const text = searchText.trim();
  if (!text) return [];

  const queries: ClaimSearchParam[][] = [
    [
      {
        name: 'patient.name',
        value: text,
      },
    ],
    [
      {
        name: 'provider:Practitioner.name',
        value: text,
      },
    ],
    [
      {
        name: 'provider:Organization.name',
        value: text,
      },
    ],
    [
      {
        name: 'care-team:Practitioner.name',
        value: text,
      },
    ],
    [
      {
        name: 'care-team:Organization.name',
        value: text,
      },
    ],
    [
      {
        name: 'identifier',
        value: `${CLAIM_PCN_IDENTIFIER_SYSTEM}|${text}`,
      },
    ],
  ];

  if (isValidUUID(text)) {
    queries.push([
      {
        name: '_id',
        value: text,
      },
    ]);
  }

  if (patientIds.length > 0) queries.push([patientSearchParam(patientIds)]);

  const pcnClaimId = claimIdFromPcn(text);
  if (pcnClaimId) {
    queries.push([
      {
        name: '_id',
        value: pcnClaimId,
      },
    ]);
  }

  return queries;
}

const claimLastUpdated = (claim: Claim): number => {
  const parsed = claim.meta?.lastUpdated ? Date.parse(claim.meta.lastUpdated) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

const unionClaimsNewestFirst = (claims: Claim[]): Claim[] =>
  deduplicateUnbundledResources(claims).sort((a, b) => claimLastUpdated(b) - claimLastUpdated(a));

export const describeClaimSearchClause = (clause: ClaimSearchParam[]): string =>
  clause.map(({ name, value }) => `${name}=${value}`).join('&');

export async function searchClaimsBySearchText({
  oystehr,
  searchText,
  filterParams,
  withServiceDateElements,
}: {
  oystehr: Oystehr;
  searchText: string;
  filterParams: ClaimSearchParam[];
  withServiceDateElements: boolean;
}): Promise<Claim[]> {
  const pageParams: ClaimSearchParam[] = [
    {
      name: '_elements',
      // getClaimServiceDate reads item and created, and Claim has no service-date search parameter,
      // so that filter has to run in memory over these ids.
      value: withServiceDateElements ? 'id,meta,created,item' : 'id,meta',
    },
    {
      name: '_count',
      value: String(CLAIM_SEARCH_TEXT_MATCH_LIMIT),
    },
    {
      name: '_total',
      value: 'accurate',
    },
  ];

  const patientIds = isValidUUID(searchText.trim())
    ? await resolveLinkedPatientIds({
        oystehr,
        patientId: searchText.trim(),
      })
    : [];

  const clauses = buildClaimSearchTextQueries({ searchText, patientIds });

  const claims: Claim[] = [];
  const truncatedClauses: string[] = [];
  for (let start = 0; start < clauses.length; start += CLAIM_SEARCH_TEXT_CONCURRENCY) {
    const chunk = clauses.slice(start, start + CLAIM_SEARCH_TEXT_CONCURRENCY);
    const bundles = await Promise.all(
      chunk.map(async (clause) => {
        try {
          return await oystehr.fhir.search<Claim>({
            resourceType: 'Claim',
            params: [...filterParams, ...clause, ...pageParams],
          });
        } catch (error) {
          // One unsupported clause shouldn't empty the whole search, but it must be loud.
          console.error(`Claim search clause failed (${describeClaimSearchClause(clause)}):`, error);
          return undefined;
        }
      })
    );

    bundles.forEach((bundle, index) => {
      if (!bundle) return;
      const clause = describeClaimSearchClause(chunk[index]);
      console.debug(`claim search clause matched ${bundle.total ?? 'unknown'}: ${clause}`);
      if ((bundle.total ?? 0) > CLAIM_SEARCH_TEXT_MATCH_LIMIT) truncatedClauses.push(clause);
      claims.push(...bundle.unbundle());
    });
  }

  if (truncatedClauses.length > 0) {
    console.warn(
      `Claim search hit the ${CLAIM_SEARCH_TEXT_MATCH_LIMIT} match limit, so results are partial for: ` +
        truncatedClauses.join(', ')
    );
  }

  return unionClaimsNewestFirst(claims);
}

export async function fetchClaimsPageByIds({
  oystehr,
  claimIds,
}: {
  oystehr: Oystehr;
  claimIds: string[];
}): Promise<{ claims: Claim[]; includedResources: Resource[] }> {
  if (claimIds.length === 0) {
    return {
      claims: [],
      includedResources: [],
    };
  }

  const bundle = await oystehr.fhir.search<Claim>({
    resourceType: 'Claim',
    params: [
      {
        name: '_id',
        value: claimIds.join(','),
      },
      ...CLAIM_LIST_INCLUDE_PARAMS,
      {
        name: '_count',
        value: String(claimIds.length),
      },
    ],
  });

  const includedResources = (bundle.entry ?? []).map((e) => e.resource).filter(Boolean) as Resource[];
  const claimsById = new Map(
    includedResources.filter((r): r is Claim => r.resourceType === 'Claim' && !!r.id).map((claim) => [claim.id, claim])
  );

  const claims = claimIds.map((id) => claimsById.get(id)).filter((claim): claim is Claim => !!claim);
  console.debug(`fetchClaimsPageByIds: asked for ${claimIds.length} claim(s), hydrated ${claims.length}`);

  return {
    claims,
    includedResources,
  };
}

async function enrichAndMapClaims(
  oystehr: Oystehr,
  claims: Claim[],
  included: { patients: Patient[]; locations: Location[]; providers: (Practitioner | Organization)[] }
): Promise<BillingClaimItem[]> {
  // Batch-fetch coverages for the current page
  const coverageIds = claims
    .map((c) => sortClaimInsurance(c)[0]?.coverage?.reference?.replace('Coverage/', ''))
    .filter(Boolean) as string[];
  const uniqueCoverageIds = [...new Set(coverageIds)];

  let coverages: Coverage[] = [];
  if (uniqueCoverageIds.length > 0) {
    const covResult = await oystehr.fhir.search<Coverage>({
      resourceType: 'Coverage',
      params: [{ name: '_id', value: uniqueCoverageIds.join(',') }],
    });
    coverages = covResult.unbundle();
  }

  const [payersByRef, claimResponsesByClaimId, patientPaidByClaimId] = await Promise.all([
    resolvePayersByRef(
      oystehr,
      claims.map((c) => c.insurer?.reference)
    ),
    fetchClaimResponsesByClaimIds(oystehr, claims.map((c) => c.id).filter(Boolean) as string[]),
    fetchPatientPaidByClaimId({
      oystehr,
      claims,
    }),
  ]);

  const lookups: ClaimLookups = {
    patients: included.patients,
    payersByRef,
    locations: included.locations,
    providers: included.providers,
    coverages,
    claimResponsesByClaimId,
    patientPaidByClaimId,
  };
  return claims.map((claim) => mapClaimToItem(claim, lookups));
}

interface ClaimLookups {
  patients: Patient[];
  payersByRef: Map<string, Organization>;
  locations: Location[];
  providers: (Practitioner | Organization)[];
  coverages: Coverage[];
  claimResponsesByClaimId: Map<string, ClaimResponse[]>;
  patientPaidByClaimId: Map<string, number>;
}

export function mapClaimToItem(claim: Claim, lookups: ClaimLookups): BillingClaimItem {
  const patient = findRef<Patient>(lookups.patients, claim.patient?.reference);
  const insurer = claim.insurer?.reference ? lookups.payersByRef.get(claim.insurer.reference) : undefined;
  const facility = findRef<Location>(lookups.locations, claim.facility?.reference);
  const sortedInsurance = sortClaimInsurance(claim);
  const coverage = findRef<Coverage>(lookups.coverages, sortedInsurance[0]?.coverage?.reference);
  const billed = claim.total?.value ?? 0;

  const renderingRef = claim.careTeam?.[0]?.provider?.reference;
  const renderingProvider = findRef<Practitioner | Organization>(lookups.providers, renderingRef);
  const patientName = fhirName(patient);

  const serviceDate = getClaimServiceDate(claim);
  const patientPaid = lookups.patientPaidByClaimId.get(claim.id ?? '') ?? 0;
  const payments = summarizeClaimPayments(
    lookups.claimResponsesByClaimId.get(claim.id ?? '') ?? [],
    billed,
    patientPaid
  );

  return {
    id: claim.id ?? '',
    type: getClaimType(claim),
    status: getClaimStatus(claim),
    statuses: getClaimStatusValues(claim),
    rulesEngine: determineRulesEngineForClaim(claim),
    patientName,
    patientDob: patient?.birthDate ?? '',
    payerName: insurer?.name ?? '',
    payerId: getPayerId(insurer) ?? '',
    memberId: coverage?.subscriberId ?? '',
    service: getClaimService(claim),
    serviceDate,
    facility: facility?.name ?? '',
    renderingProvider: resourceDisplayName(renderingProvider) ?? '',
    billed,
    allowed: payments.allowed,
    insurancePaid: payments.insurancePaid,
    patientResp: payments.patientResp,
    patientPaid: payments.patientPaid,
    claimBalance: payments.balance,
    adjudicated: payments.adjudicated,
    responsibleParty: 'Primary',
    tags: (claim.meta?.tag ?? [])
      .filter((t) => t.system === CLAIM_TAG_SYSTEM)
      .map((t) => t.code ?? '')
      .filter(Boolean),
  };
}
