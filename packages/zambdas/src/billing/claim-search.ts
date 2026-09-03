import Oystehr, { FhirResourceReturnValue } from '@oystehr/sdk';
import { Claim, ClaimResponse, Coverage, Location, Organization, Patient, Practitioner, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { deduplicateUnbundledResources } from 'utils/lib/fhir/deduplicateUnbundledResources';
import { searchPageWithSizeRetry } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getPayerId, getPayerUrl } from 'utils/lib/helpers/helpers';
import { CODE_SYSTEM_CLAIM_TYPE, CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM } from 'utils/lib/helpers/rcm/constants';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { SearchBillingClaimsInput } from 'utils/lib/types/data/billing/billing.schemas';
import { BillingClaimItem } from 'utils/lib/types/data/billing/billing.types';
import { CLAIM_STATUS_TAG_SYSTEMS, getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { isValidUUID } from 'utils/lib/validation/helper';
import { fetchClaimResponsesByClaimIds, fetchPatientPaidByClaimId, summarizeClaimPayments } from './claim-amounts';
import {
  CLAIM_PCN_IDENTIFIER_SYSTEM,
  ClaimSearchParam,
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
  SOURCE_FRIENDLY_PATIENT_ID_SYSTEM,
  SOURCE_IDENTIFIER_SYSTEM,
} from './shared';

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

// WARNING: this list must cover every field read from resources returned by the claim list search
// bundle. If you access a new field on any of these resource types downstream (including via
// mapClaimToItem's helpers or enrichAndMapClaims' follow-up fetches), you MUST add it here —
// otherwise the server strips it via _elements and it arrives as undefined.
export const CLAIM_LIST_ELEMENTS = [
  'Claim.id',
  'Claim.meta',
  'Claim.status',
  'Claim.type',
  // fetchPatientPaidByClaimId keys the patient payment total off the claim-encounter-id identifier.
  'Claim.identifier',
  'Claim.created',
  'Claim.total',
  'Claim.patient',
  'Claim.insurer',
  'Claim.facility',
  // Not mapped, but kept so the server can still resolve _include Claim:provider.
  'Claim.provider',
  'Claim.careTeam',
  'Claim.insurance',
  'Claim.item',
  'Patient.id',
  'Patient.name',
  'Patient.birthDate',
  'Location.id',
  'Location.name',
  'Practitioner.id',
  'Practitioner.name',
  'Organization.id',
  'Organization.name',
].join(',');

// The include + _elements pair every claim list read uses. Paired in one constant so a new list
// query cannot pick up the includes and forget to narrow the fields they drag in.
export const CLAIM_LIST_PARAMS: ClaimSearchParam[] = [
  ...CLAIM_LIST_INCLUDE_PARAMS,
  {
    name: '_elements',
    value: CLAIM_LIST_ELEMENTS,
  },
];

export type ClaimFilterInput = Pick<
  SearchBillingClaimsInput,
  | 'type'
  | 'status'
  | 'arStage'
  | 'createdFrom'
  | 'createdTo'
  | 'patientId'
  | 'service'
  | 'payerId'
  | 'payerName'
  | 'tag'
>;

export async function buildClaimFilterParams({
  oystehr,
  params,
  sort = '-_lastUpdated',
}: {
  oystehr: Oystehr;
  params: ClaimFilterInput;
  sort?: string;
}): Promise<ClaimSearchParam[]> {
  let insurerFilter: string | undefined;
  if (params.payerId) {
    insurerFilter = getPayerUrl(params.payerId);
  } else if (params.payerName) {
    const result = await oystehr.rcm.listPayers({
      name: params.payerName,
      limit: 50,
    });
    const payerIds = result.data.map((p) => getPayerId(p)).filter(Boolean) as string[];
    if (payerIds.length === 0) throw INVALID_INPUT_ERROR(`No payer matches the payer name "${params.payerName}"`);
    insurerFilter = payerIds.map((id) => getPayerUrl(id)).join(',');
  }

  const filterParams: ClaimSearchParam[] = [
    {
      name: '_sort',
      value: sort,
    },
  ];

  if (params.type)
    filterParams.push({
      name: '_tag',
      value: `${CODE_SYSTEM_CLAIM_TYPE}|${params.type}`,
    });
  if (params.status) {
    filterParams.push({
      name: '_tag',
      value: `${CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus}|${params.status},${CLAIM_STATUS_TAG_SYSTEMS.insurancePaidStatus}|${params.status},${CLAIM_STATUS_TAG_SYSTEMS.adjudicationStatus}|${params.status},${CLAIM_STATUS_TAG_SYSTEMS.patientArStatus}|${params.status},${CLAIM_STATUS_TAG_SYSTEMS.patientPaidStatus}|${params.status},${CLAIM_STATUS_TAG_SYSTEMS.nonInsuranceArStatus}|${params.status},${CLAIM_STATUS_TAG_SYSTEMS.nonInsurancePaidStatus}|${params.status}`,
    });
  }
  if (params.arStage)
    filterParams.push({
      name: '_tag',
      value: `${CLAIM_STATUS_TAG_SYSTEMS.arStage}|${params.arStage}`,
    });
  if (params.createdFrom)
    filterParams.push({
      name: 'created',
      value: `ge${params.createdFrom}`,
    });
  if (params.createdTo)
    filterParams.push({
      name: 'created',
      value: `le${params.createdTo}`,
    });
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
    filterParams.push({
      name: '_tag',
      value: `${CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM}|${params.service}`,
    });
  if (insurerFilter)
    filterParams.push({
      name: 'insurer',
      value: insurerFilter,
    });
  if (params.tag)
    filterParams.push({
      name: '_tag',
      value: `${CLAIM_TAG_SYSTEM}|${params.tag}`,
    });

  return filterParams;
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

export const CLAIM_SEARCH_TEXT_MATCH_LIMIT = 1000;
export const CLAIM_SEARCH_TEXT_CONCURRENCY = 4;

export const claimScanElements = (withServiceDate: boolean): ClaimSearchParam => ({
  name: '_elements',
  value: withServiceDate ? 'id,meta,created,item' : 'id,meta',
});

export function buildClaimSearchTextQueries({
  searchText,
  patientNameOnly,
}: {
  searchText: string;
  patientNameOnly?: boolean;
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
  ];

  if (!patientNameOnly) {
    queries.push(
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
      [
        {
          name: 'patient.identifier',
          value: `${SOURCE_IDENTIFIER_SYSTEM}|${text}`,
        },
      ],
      [
        {
          name: 'patient.identifier',
          value: `${SOURCE_FRIENDLY_PATIENT_ID_SYSTEM}|${text}`,
        },
      ]
    );
  }

  if (isValidUUID(text)) {
    queries.push([
      {
        name: '_id',
        value: text,
      },
    ]);
  }

  return queries;
}

const claimLastUpdated = (claim: Claim): number => {
  const parsed = claim.meta?.lastUpdated ? Date.parse(claim.meta.lastUpdated) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

const unionClaimsNewestFirst = (claims: FhirResourceReturnValue<Claim>[]): FhirResourceReturnValue<Claim>[] =>
  deduplicateUnbundledResources(claims).sort((a, b) => claimLastUpdated(b) - claimLastUpdated(a));

export const CLAIM_SCAN_PAGE_SIZE = 1000;

/**
 * Resolve the claims one query matches, as ids and the few fields an in-memory filter needs — never
 * the full resource and never the includes, both of which belong to the page hydration. Pages until
 * the query is drained or `maxMatches` is reached, shrinking the page when the server refuses the
 * response size, and reports whether the server had more matches than it collected.
 */
export async function scanClaimIds({
  oystehr,
  params,
  maxMatches,
  withServiceDate,
}: {
  oystehr: Oystehr;
  params: ClaimSearchParam[];
  maxMatches: number;
  withServiceDate: boolean;
}): Promise<{ claims: FhirResourceReturnValue<Claim>[]; incomplete: boolean }> {
  const searchParams = {
    resourceType: 'Claim' as const,
    params: [...params, claimScanElements(withServiceDate)],
  };

  const claims: FhirResourceReturnValue<Claim>[] = [];
  let pageSize = CLAIM_SCAN_PAGE_SIZE;
  let total = 0;

  while (claims.length < maxMatches) {
    const requested = Math.min(pageSize, maxMatches - claims.length);
    const page = await searchPageWithSizeRetry<Claim>(oystehr, searchParams, {
      offset: claims.length,
      count: requested,
    });
    if (page.count < requested) pageSize = page.count;

    total = page.bundle.total ?? 0;
    const matched = page.bundle
      .unbundle()
      .filter((claim): claim is FhirResourceReturnValue<Claim> => claim.resourceType === 'Claim' && !!claim.id);
    claims.push(...matched);
    if (matched.length === 0 || claims.length >= total) break;
  }

  return {
    claims: deduplicateUnbundledResources(claims),
    incomplete: total > claims.length,
  };
}

export const describeClaimSearchClause = (clause: ClaimSearchParam[]): string =>
  clause
    .map(({ name, value }) => {
      const values = value.split(',').length;
      return values > 1 ? `${name}(${values} values)` : name;
    })
    .join('&');

export async function searchClaimsBySearchText({
  oystehr,
  searchText,
  filterParams,
  withServiceDateElements,
  patientNameOnly,
}: {
  oystehr: Oystehr;
  searchText: string;
  filterParams: ClaimSearchParam[];
  withServiceDateElements: boolean;
  patientNameOnly?: boolean;
}): Promise<{ claims: FhirResourceReturnValue<Claim>[]; incomplete: boolean }> {
  const clauses = buildClaimSearchTextQueries({ searchText, patientNameOnly });

  const claims: FhirResourceReturnValue<Claim>[] = [];
  const truncatedClauses: string[] = [];
  let failures = 0;
  let lastFailure: unknown;
  for (let start = 0; start < clauses.length; start += CLAIM_SEARCH_TEXT_CONCURRENCY) {
    const chunk = clauses.slice(start, start + CLAIM_SEARCH_TEXT_CONCURRENCY);
    const scans = await Promise.all(
      chunk.map(async (clause) => {
        try {
          return await scanClaimIds({
            oystehr,
            params: [...filterParams, ...clause],
            maxMatches: CLAIM_SEARCH_TEXT_MATCH_LIMIT,
            withServiceDate: withServiceDateElements,
          });
        } catch (error) {
          // One clause the server won't accept shouldn't empty the search, but it must be loud.
          console.error(`Claim search clause failed (${describeClaimSearchClause(clause)}):`, error);
          failures += 1;
          lastFailure = error;
          return undefined;
        }
      })
    );

    scans.forEach((scan, index) => {
      if (!scan) return;
      const clause = describeClaimSearchClause(chunk[index]);
      console.debug(`claim search clause matched ${scan.claims.length}: ${clause}`);
      if (scan.incomplete) truncatedClauses.push(clause);
      claims.push(...scan.claims);
    });
  }

  if (clauses.length > 0 && failures === clauses.length) throw lastFailure;

  if (truncatedClauses.length > 0) {
    console.warn(
      `Claim search hit the ${CLAIM_SEARCH_TEXT_MATCH_LIMIT} match limit, so results are partial for: ` +
        truncatedClauses.join(', ')
    );
  }

  return {
    claims: unionClaimsNewestFirst(claims),
    incomplete: truncatedClauses.length > 0 || failures > 0,
  };
}

export async function fetchClaimsPageByIds({
  oystehr,
  claimIds,
}: {
  oystehr: Oystehr;
  claimIds: string[];
}): Promise<{ claims: FhirResourceReturnValue<Claim>[]; includedResources: Resource[] }> {
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
      ...CLAIM_LIST_PARAMS,
      {
        name: '_count',
        value: String(claimIds.length),
      },
    ],
  });

  const includedResources = (bundle.entry ?? []).map((e) => e.resource).filter(Boolean) as Resource[];
  const claimsById = new Map(
    includedResources
      .filter((r): r is FhirResourceReturnValue<Claim> => r.resourceType === 'Claim' && !!r.id)
      .map((claim) => [claim.id, claim])
  );

  const claims = claimIds
    .map((id) => claimsById.get(id))
    .filter((claim): claim is FhirResourceReturnValue<Claim> => !!claim);
  console.debug(`fetchClaimsPageByIds: asked for ${claimIds.length} claim(s), hydrated ${claims.length}`);

  return {
    claims,
    includedResources,
  };
}

export async function enrichAndMapClaims({
  oystehr,
  claims,
  includedResources,
}: {
  oystehr: Oystehr;
  claims: Claim[];
  includedResources: Resource[];
}): Promise<BillingClaimItem[]> {
  const patients = includedResources.filter((r): r is Patient => r.resourceType === 'Patient');
  const locations = includedResources.filter((r): r is Location => r.resourceType === 'Location');
  const providers = includedResources.filter(
    (r): r is Practitioner | Organization => r.resourceType === 'Practitioner' || r.resourceType === 'Organization'
  );

  const coverageIds = claims
    .map((c) => sortClaimInsurance(c)[0]?.coverage?.reference?.replace('Coverage/', ''))
    .filter(Boolean) as string[];
  const uniqueCoverageIds = [...new Set(coverageIds)];

  let coverages: Coverage[] = [];
  if (uniqueCoverageIds.length > 0) {
    const covResult = await oystehr.fhir.search<Coverage>({
      resourceType: 'Coverage',
      params: [
        {
          name: '_id',
          value: uniqueCoverageIds.join(','),
        },
        {
          name: '_count',
          value: String(uniqueCoverageIds.length),
        },
      ],
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
    patients,
    payersByRef,
    locations,
    providers,
    coverages,
    claimResponsesByClaimId,
    patientPaidByClaimId,
  };
  return claims.map((claim) => mapClaimToItem(claim, lookups));
}

export interface ClaimLookups {
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
