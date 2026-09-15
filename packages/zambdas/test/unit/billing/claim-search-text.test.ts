import Oystehr from '@oystehr/sdk';
import { Claim, Resource } from 'fhir/r4b';
import { CLAIM_SCAN_MATCH_LIMIT } from 'utils/lib/types/data/billing/billing.constants';
import { afterEach, describe, expect, it, Mock, vi } from 'vitest';
import {
  buildClaimSearchTextQueries,
  CLAIM_LIST_ELEMENTS,
  CLAIM_LIST_INCLUDE_PARAMS,
  CLAIM_SEARCH_TEXT_MATCH_LIMIT,
  describeClaimSearchClause,
  enrichAndMapClaims,
  fetchClaimsPageByIds,
  scanClaimIds,
  searchClaimsBySearchText,
} from '../../../src/billing/claim-search';
import { CLAIM_PCN_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';

const CLAIM_ID = '3f2b9c1a-7d4e-4a8b-9c6d-0e1f2a3b4c5d';
const PATIENT_ID = '8a1c4e2f-5b6d-4c3a-9e8f-1d2c3b4a5e6f';

const NAME_CLAUSES = [
  'patient.name',
  'provider:Practitioner.name',
  'provider:Organization.name',
  'care-team:Practitioner.name',
  'care-team:Organization.name',
];

const clauseNames = (searchText: string): string[] =>
  buildClaimSearchTextQueries({ searchText }).flatMap((params) => params.map((p) => p.name));

const clauseFor = (searchText: string, name: string): { name: string; value: string }[] =>
  buildClaimSearchTextQueries({ searchText })
    .flat()
    .filter((p) => p.name === name);

describe('buildClaimSearchTextQueries', () => {
  it('searches every name field plus the PCN identifier, and no token clause, for a plain name', () => {
    expect(clauseNames('Smith')).toEqual([...NAME_CLAUSES, 'identifier', 'patient.identifier', 'patient.identifier']);
  });

  it('sends the same text to each name clause, so either half of a name matches', () => {
    const queries = buildClaimSearchTextQueries({ searchText: 'Smith' });
    NAME_CLAUSES.forEach((name) => {
      expect(clauseFor('Smith', name)).toEqual([
        {
          name,
          value: 'Smith',
        },
      ]);
    });
    // One clause per field, never combined into a single search.
    expect(queries.every((params) => params.length === 1)).toBe(true);
  });

  it('scopes the PCN clause to the patient control number system', () => {
    expect(clauseFor('CUSTOM-PCN-1', 'identifier')).toEqual([
      {
        name: 'identifier',
        value: `${CLAIM_PCN_IDENTIFIER_SYSTEM}|CUSTOM-PCN-1`,
      },
    ]);
  });

  it('adds a claim id clause for a uuid', () => {
    expect(clauseNames(CLAIM_ID)).toEqual([
      ...NAME_CLAUSES,
      'identifier',
      'patient.identifier',
      'patient.identifier',
      '_id',
    ]);
    expect(clauseFor(CLAIM_ID, '_id')).toEqual([
      {
        name: '_id',
        value: CLAIM_ID,
      },
    ]);
  });

  it('omits the patient clause when nothing was resolved', () => {
    expect(clauseNames(PATIENT_ID)).not.toContain('patient');
    expect(clauseNames('Smith')).not.toContain('patient');
  });

  it('keeps the fan-out to at most eight clauses', () => {
    expect(buildClaimSearchTextQueries({ searchText: 'Smith' })).toHaveLength(8);
    expect(buildClaimSearchTextQueries({ searchText: CLAIM_ID })).toHaveLength(9);
  });

  it('trims the text and searches nothing when it is blank', () => {
    expect(clauseFor('  Smith  ', 'patient.name')).toEqual([
      {
        name: 'patient.name',
        value: 'Smith',
      },
    ]);
    expect(buildClaimSearchTextQueries({ searchText: '   ' })).toEqual([]);
    expect(buildClaimSearchTextQueries({ searchText: '' })).toEqual([]);
  });

  describe('patientNameOnly', () => {
    const scopedClauseNames = (searchText: string): string[] =>
      buildClaimSearchTextQueries({ searchText, patientNameOnly: true }).flatMap((params) => params.map((p) => p.name));

    it('searches only the patient name for plain text', () => {
      expect(scopedClauseNames('Smith')).toEqual(['patient.name']);
    });
  });
});

const makeClaim = (id: string, lastUpdated?: string): Claim =>
  ({
    resourceType: 'Claim',
    id,
    meta: lastUpdated
      ? {
          lastUpdated,
        }
      : undefined,
  }) as unknown as Claim;

const AR_STAGE_FILTER = {
  name: '_tag',
  value: 'https://fhir.ottehr.com/billing/ar-stage|insurance-payer',
};

const FILTER_PARAMS = [
  {
    name: '_sort',
    value: '-_lastUpdated',
  },
  AR_STAGE_FILTER,
];

type SearchParam = { name: string; value: string };

const bundleOf = (claims: Claim[], total = claims.length): unknown => ({
  total,
  unbundle: () => claims,
  entry: claims.map((resource) => ({ resource })),
});

const bundleWithoutTotal = (claims: Claim[]): unknown => ({
  unbundle: () => claims,
  entry: claims.map((resource) => ({ resource })),
});

// The claim searches and the Person lookup share one fhir.search stub, dispatched on resourceType.
// personLinks holds one entry per billing Person the link search finds, with that Person's patient ids.
const stubClient = ({
  personLinks = [],
  claimsPerClause = [],
}: {
  personLinks?: string[][];
  claimsPerClause?: Claim[][];
} = {}): {
  oystehr: Oystehr;
  search: Mock;
} => {
  let clauseIndex = 0;
  const search = vi.fn().mockImplementation(async ({ resourceType }: { resourceType: string }) => {
    if (resourceType === 'Person') {
      return {
        unbundle: () =>
          personLinks.map((links, index) => ({
            resourceType: 'Person',
            id: `person-${index + 1}`,
            link: links.map((id) => ({
              target: {
                reference: `Patient/${id}`,
              },
            })),
          })),
      };
    }
    return bundleOf(claimsPerClause[clauseIndex++] ?? []);
  });
  return {
    oystehr: {
      fhir: {
        search,
      },
    } as unknown as Oystehr,
    search,
  };
};

const claimSearchCalls = (search: Mock): SearchParam[][] =>
  search.mock.calls.filter((call) => call[0].resourceType === 'Claim').map((call) => call[0].params as SearchParam[]);

const paramNamed = (params: SearchParam[], name: string): SearchParam | undefined =>
  params.find((param) => param.name === name);

describe('scanClaimIds', () => {
  const stubScanClient = (
    matches: Claim[],
    {
      total = matches.length,
      failSizeFor = 0,
      omitTotal = false,
    }: {
      total?: number;
      failSizeFor?: number;
      omitTotal?: boolean;
    } = {}
  ): {
    oystehr: Oystehr;
    search: Mock;
  } => {
    let sizeFailuresLeft = failSizeFor;
    const search = vi.fn().mockImplementation(async ({ params }: { params: SearchParam[] }) => {
      if (sizeFailuresLeft > 0) {
        sizeFailuresLeft -= 1;
        throw new Oystehr.OystehrSdkError({
          code: 4130,
          // 7Mb > 6Mb limit
          message: 'An internal response size (7,340,032) exceeds the maximum allowed size (6,291,456).',
        });
      }
      const offset = Number(paramNamed(params, '_offset')?.value ?? 0);
      const count = Number(paramNamed(params, '_count')?.value ?? matches.length);
      const page = matches.slice(offset, offset + count);
      return omitTotal ? bundleWithoutTotal(page) : bundleOf(page, total);
    });
    return {
      oystehr: {
        fhir: {
          search,
        },
      } as unknown as Oystehr,
      search,
    };
  };

  const claimsNumbered = (count: number): Claim[] =>
    Array.from({ length: count }, (_unused, index) => makeClaim(`claim-${index}`, '2026-07-01T00:00:00Z'));

  it('asks only for ids, never the resources the page hydration fetches', async () => {
    const { oystehr, search } = stubScanClient(claimsNumbered(2));

    await scanClaimIds({
      oystehr,
      params: FILTER_PARAMS,
      maxMatches: CLAIM_SEARCH_TEXT_MATCH_LIMIT,
      withServiceDate: false,
    });

    const [params] = claimSearchCalls(search);
    expect(params).toContainEqual(AR_STAGE_FILTER);
    expect(paramNamed(params, '_elements')?.value).toBe('id,meta');
    expect(paramNamed(params, '_include')).toBeUndefined();
    expect(paramNamed(params, '_total')?.value).toBe('accurate');
  });

  it('asks for the service date fields when the filter needs them', async () => {
    const { oystehr, search } = stubScanClient(claimsNumbered(1));

    await scanClaimIds({
      oystehr,
      params: [],
      maxMatches: CLAIM_SEARCH_TEXT_MATCH_LIMIT,
      withServiceDate: true,
    });

    expect(paramNamed(claimSearchCalls(search)[0], '_elements')?.value).toBe('id,meta,created,item');
  });

  it('pages until the query is drained', async () => {
    const { oystehr, search } = stubScanClient(claimsNumbered(2500));

    const { claims, incomplete } = await scanClaimIds({
      oystehr,
      params: [],
      maxMatches: CLAIM_SCAN_MATCH_LIMIT,
      withServiceDate: false,
    });

    expect(claims).toHaveLength(2500);
    expect(incomplete).toBe(false);
    expect(claimSearchCalls(search).map((params) => paramNamed(params, '_offset')?.value)).toEqual([
      '0',
      '1000',
      '2000',
    ]);
  });

  it('stops at the match limit and reports the result as incomplete', async () => {
    const { oystehr, search } = stubScanClient(claimsNumbered(2500));

    const { claims, incomplete } = await scanClaimIds({
      oystehr,
      params: [],
      maxMatches: 1500,
      withServiceDate: false,
    });

    expect(claims).toHaveLength(1500);
    expect(incomplete).toBe(true);
    // Never asks for more than the headroom left to the limit.
    expect(claimSearchCalls(search).map((params) => paramNamed(params, '_count')?.value)).toEqual(['1000', '500']);
  });

  it('shrinks the page when the server refuses the response size, and still collects every match', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { oystehr, search } = stubScanClient(claimsNumbered(600), { failSizeFor: 1 });

    const { claims, incomplete } = await scanClaimIds({
      oystehr,
      params: [],
      maxMatches: CLAIM_SCAN_MATCH_LIMIT,
      withServiceDate: false,
    });

    expect(claims.map((claim) => claim.id)).toEqual(claimsNumbered(600).map((claim) => claim.id));
    expect(incomplete).toBe(false);
    // 1000 refused, then 500 and the remaining 100 — the reduced size carries to the next page.
    expect(claimSearchCalls(search).map((params) => paramNamed(params, '_count')?.value)).toEqual([
      '1000',
      '500',
      '500',
    ]);
  });

  // A claim updated mid-scan moves under the _lastUpdated sort and can be returned on two pages.
  it('does not return the same claim twice when it lands on two pages', async () => {
    const { oystehr } = stubScanClient([...claimsNumbered(1000), makeClaim('claim-0', '2026-07-02T00:00:00Z')]);

    const { claims } = await scanClaimIds({
      oystehr,
      params: [],
      maxMatches: CLAIM_SCAN_MATCH_LIMIT,
      withServiceDate: false,
    });

    expect(claims.filter((claim) => claim.id === 'claim-0')).toHaveLength(1);
  });

  it('does not loop forever when the server reports a total it will not return', async () => {
    const { oystehr, search } = stubScanClient(claimsNumbered(3), { total: 900 });

    const { claims, incomplete } = await scanClaimIds({
      oystehr,
      params: [],
      maxMatches: CLAIM_SCAN_MATCH_LIMIT,
      withServiceDate: false,
    });

    expect(claims).toHaveLength(3);
    expect(incomplete).toBe(true);
    expect(claimSearchCalls(search)).toHaveLength(2);
  });

  it('counts distinct claims against the match limit, not repeated rows', async () => {
    const repeated = makeClaim('claim-a', '2026-07-01T00:00:00Z');
    const { oystehr } = stubScanClient([
      repeated,
      repeated,
      makeClaim('claim-b', '2026-07-01T00:00:00Z'),
      makeClaim('claim-c', '2026-07-01T00:00:00Z'),
    ]);

    const { claims } = await scanClaimIds({
      oystehr,
      params: [],
      maxMatches: 3,
      withServiceDate: false,
    });

    expect(claims.map((claim) => claim.id)).toEqual(['claim-a', 'claim-b', 'claim-c']);
  });

  // A claim edited mid-scan moves to the head of the sort, so a later page repeats a row already
  // read and the moved claim never comes back at all.
  it('reports incomplete when a repeated row left a claim unread', async () => {
    const repeated = makeClaim('claim-a', '2026-07-01T00:00:00Z');
    const { oystehr } = stubScanClient([repeated, repeated], { total: 2 });

    const { claims, incomplete } = await scanClaimIds({
      oystehr,
      params: [],
      maxMatches: CLAIM_SCAN_MATCH_LIMIT,
      withServiceDate: false,
    });

    expect(claims.map((claim) => claim.id)).toEqual(['claim-a']);
    expect(incomplete).toBe(true);
  });

  // Only the distinct count bounds the loop, so a server that answers every offset with rows
  // already seen would otherwise page until the lambda runs out of memory.
  it('stops when a page repeats only claims already scanned', async () => {
    const repeated = makeClaim('claim-a', '2026-07-01T00:00:00Z');
    let served = 0;
    const search = vi.fn().mockImplementation(async () => {
      served += 1;
      if (served > 3) throw new Error('kept paging on rows it had already scanned');
      return bundleOf([repeated], 900);
    });

    const { claims, incomplete } = await scanClaimIds({
      oystehr: {
        fhir: {
          search,
        },
      } as unknown as Oystehr,
      params: [],
      maxMatches: CLAIM_SCAN_MATCH_LIMIT,
      withServiceDate: false,
    });

    expect(claims.map((claim) => claim.id)).toEqual(['claim-a']);
    expect(incomplete).toBe(true);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('keeps paging when the bundle carries no total', async () => {
    const { oystehr, search } = stubScanClient(claimsNumbered(2500), { omitTotal: true });

    const { claims, incomplete } = await scanClaimIds({
      oystehr,
      params: [],
      maxMatches: CLAIM_SCAN_MATCH_LIMIT,
      withServiceDate: false,
    });

    expect(claims).toHaveLength(2500);
    expect(incomplete).toBe(false);
    expect(claimSearchCalls(search).map((params) => paramNamed(params, '_offset')?.value)).toEqual([
      '0',
      '1000',
      '2000',
    ]);
  });

  it('ends a total-less scan on the first page the server cannot fill', async () => {
    const { oystehr, search } = stubScanClient(claimsNumbered(1000), { omitTotal: true });

    const { claims, incomplete } = await scanClaimIds({
      oystehr,
      params: [],
      maxMatches: CLAIM_SCAN_MATCH_LIMIT,
      withServiceDate: false,
    });

    expect(claims).toHaveLength(1000);
    expect(incomplete).toBe(false);
    expect(claimSearchCalls(search)).toHaveLength(2);
  });

  it('reports the match cap as incomplete when the bundle carries no total', async () => {
    const { oystehr } = stubScanClient(claimsNumbered(3000), { omitTotal: true });

    const { claims, incomplete } = await scanClaimIds({
      oystehr,
      params: [],
      maxMatches: 1500,
      withServiceDate: false,
    });

    expect(claims).toHaveLength(1500);
    expect(incomplete).toBe(true);
  });
});

describe('describeClaimSearchClause', () => {
  it('names the parameter without echoing the searched text', () => {
    expect(
      describeClaimSearchClause([
        {
          name: 'patient.name',
          value: 'Smith',
        },
      ])
    ).toBe('patient.name');
  });

  it('reports how many values a widened clause carries, to tell it from a bare one', () => {
    expect(
      describeClaimSearchClause([
        {
          name: 'patient',
          value: `Patient/${PATIENT_ID},Patient/copy-1`,
        },
      ])
    ).toBe('patient(2 values)');
  });

  it('joins a multi-parameter clause by name alone', () => {
    expect(
      describeClaimSearchClause([
        {
          name: '_id',
          value: CLAIM_ID,
        },
        {
          name: '_tag',
          value: 'system|code',
        },
      ])
    ).toBe('_id&_tag');
  });
});

describe('searchClaimsBySearchText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('searches through the SDK rather than hand-built batch urls, so values are encoded once', async () => {
    const { oystehr, search } = stubClient();

    await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: FILTER_PARAMS,
      withServiceDateElements: false,
    });

    expect(claimSearchCalls(search)).toHaveLength(8);
    claimSearchCalls(search).forEach((params) => {
      expect(params).toContainEqual(AR_STAGE_FILTER);
      expect(paramNamed(params, '_elements')?.value).toBe('id,meta');
      expect(paramNamed(params, '_count')?.value).toBe(String(CLAIM_SEARCH_TEXT_MATCH_LIMIT));
      expect(paramNamed(params, '_total')?.value).toBe('accurate');
      // Includes are what the page hydration is for; carrying them here would blow the response budget.
      expect(paramNamed(params, '_include')).toBeUndefined();
    });
  });

  it('searches only patient names under patientNameOnly', async () => {
    const { oystehr, search } = stubClient();

    await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: FILTER_PARAMS,
      withServiceDateElements: false,
      patientNameOnly: true,
    });

    expect(claimSearchCalls(search)).toHaveLength(1);
    const [params] = claimSearchCalls(search);
    expect(params).toContainEqual(AR_STAGE_FILTER);
    expect(paramNamed(params, 'patient.name')?.value).toBe('Smith');
  });

  it('asks for the fields the in-memory service date filter needs when a range is active', async () => {
    const { oystehr, search } = stubClient();

    await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: FILTER_PARAMS,
      withServiceDateElements: true,
    });

    claimSearchCalls(search).forEach((params) =>
      expect(paramNamed(params, '_elements')?.value).toBe('id,meta,created,item')
    );
  });

  it('does not look up a Person for text that is not a uuid', async () => {
    const { oystehr, search } = stubClient();

    await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: [],
      withServiceDateElements: false,
    });

    expect(search.mock.calls.some((call) => call[0].resourceType === 'Person')).toBe(false);
  });

  it('unions the clauses, deduping and re-sorting newest first', async () => {
    const { oystehr } = stubClient({
      claimsPerClause: [
        [makeClaim('older', '2026-01-01T00:00:00Z')],
        [makeClaim('newest', '2026-07-30T12:00:00Z'), makeClaim('older', '2026-01-01T00:00:00Z')],
        [makeClaim('middle', '2026-04-15T00:00:00Z')],
      ],
    });

    const { claims } = await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: [],
      withServiceDateElements: false,
    });
    expect(claims.map((c) => c.id)).toEqual(['newest', 'middle', 'older']);
  });

  it('sorts a claim with no lastUpdated last rather than dropping it', async () => {
    const { oystehr } = stubClient({
      claimsPerClause: [[makeClaim('undated'), makeClaim('dated', '2026-07-01T00:00:00Z')]],
    });

    const { claims } = await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: [],
      withServiceDateElements: false,
    });
    expect(claims.map((c) => c.id)).toEqual(['dated', 'undated']);
  });

  it('reports complete results when every clause succeeded within the limit', async () => {
    const { oystehr } = stubClient({
      claimsPerClause: [[makeClaim('claim-1', '2026-07-01T00:00:00Z')]],
    });

    const { incomplete } = await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: [],
      withServiceDateElements: false,
    });
    expect(incomplete).toBe(false);
  });

  it('reports incomplete results when a clause hit the match limit', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { oystehr } = stubClient();
    (oystehr.fhir.search as unknown as Mock).mockImplementation(async () =>
      bundleOf([makeClaim('claim-1', '2026-07-01T00:00:00Z')], CLAIM_SEARCH_TEXT_MATCH_LIMIT + 1)
    );

    const { incomplete } = await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: [],
      withServiceDateElements: false,
    });
    expect(incomplete).toBe(true);
  });

  it('reports incomplete results when some clauses failed but others returned', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { oystehr } = stubClient();
    let call = 0;
    (oystehr.fhir.search as unknown as Mock).mockImplementation(async () => {
      call += 1;
      if (call === 1) throw new Error('unsupported search parameter');
      return bundleOf([makeClaim('survivor', '2026-07-01T00:00:00Z')]);
    });

    const { claims, incomplete } = await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: [],
      withServiceDateElements: false,
    });
    expect(claims.map((c) => c.id)).toEqual(['survivor']);
    expect(incomplete).toBe(true);
  });

  it('chunks the clauses so one round of searches never takes too many connections', async () => {
    const { oystehr, search } = stubClient();

    await searchClaimsBySearchText({
      oystehr,
      searchText: CLAIM_ID,
      filterParams: [],
      withServiceDateElements: false,
    });
    expect(claimSearchCalls(search)).toHaveLength(9);
  });

  // One rejected clause must not empty the whole search, and it has to be loud.
  it('logs a failed clause and keeps the results of the others', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { oystehr } = stubClient();
    let call = 0;
    (oystehr.fhir.search as unknown as Mock).mockImplementation(async () => {
      call += 1;
      if (call === 1) throw new Error('unsupported search parameter');
      return bundleOf([makeClaim('survivor', '2026-07-01T00:00:00Z')]);
    });

    const { claims } = await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: [],
      withServiceDateElements: false,
    });

    expect(claims.map((c) => c.id)).toEqual(['survivor']);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toContain('patient.name');
  });

  it('throws when every clause fails rather than reporting no matches', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { oystehr } = stubClient();
    (oystehr.fhir.search as unknown as Mock).mockImplementation(async () => {
      throw new Error('401 unauthorized');
    });

    await expect(
      searchClaimsBySearchText({
        oystehr,
        searchText: 'Smith',
        filterParams: [],
        withServiceDateElements: false,
      })
    ).rejects.toThrow('401 unauthorized');
  });

  it('keeps the searched text out of the truncation warning', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { oystehr } = stubClient();
    (oystehr.fhir.search as unknown as Mock).mockImplementation(async () =>
      bundleOf([makeClaim('claim-1', '2026-07-01T00:00:00Z')], CLAIM_SEARCH_TEXT_MATCH_LIMIT + 1)
    );

    await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: [],
      withServiceDateElements: false,
    });

    expect(consoleWarn.mock.calls[0][0]).not.toContain('Smith');
    expect(consoleWarn.mock.calls[0][0]).toContain('patient.name');
  });

  it('warns when a clause hit the match limit, so partial results are visible', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { oystehr } = stubClient();
    (oystehr.fhir.search as unknown as Mock).mockImplementation(async () =>
      bundleOf([makeClaim('claim-1', '2026-07-01T00:00:00Z')], CLAIM_SEARCH_TEXT_MATCH_LIMIT + 1)
    );

    await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: [],
      withServiceDateElements: false,
    });

    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(consoleWarn.mock.calls[0][0]).toContain(String(CLAIM_SEARCH_TEXT_MATCH_LIMIT));
  });

  it('does not call out at all when the text is blank', async () => {
    const { oystehr, search } = stubClient();

    const { claims } = await searchClaimsBySearchText({
      oystehr,
      searchText: '   ',
      filterParams: FILTER_PARAMS,
      withServiceDateElements: false,
    });

    expect(search).not.toHaveBeenCalled();
    expect(claims).toEqual([]);
  });
});

const stubPageClient = (
  resources: Resource[]
): {
  oystehr: Oystehr;
  search: Mock;
} => {
  const search = vi.fn().mockResolvedValue({
    entry: resources.map((resource) => ({
      resource,
    })),
  });
  return {
    oystehr: {
      fhir: {
        search,
      },
    } as unknown as Oystehr,
    search,
  };
};

describe('enrichAndMapClaims', () => {
  const stubEnrichClient = (): {
    oystehr: Oystehr;
    search: Mock;
  } => {
    const search = vi.fn().mockResolvedValue({
      entry: [],
      unbundle: () => [],
    });
    return {
      oystehr: {
        fhir: {
          search,
        },
      } as unknown as Oystehr,
      search,
    };
  };

  const coverageSearchParams = (search: Mock): SearchParam[] => {
    const call = search.mock.calls.find(([arg]) => arg.resourceType === 'Coverage');
    if (!call) throw new Error('expected a Coverage search');
    return call[0].params as SearchParam[];
  };

  const claimWithCoverage = (id: string, coverageId: string): Claim =>
    ({
      resourceType: 'Claim',
      id,
      status: 'active',
      created: '2026-07-01',
      type: {
        coding: [],
      },
      total: {
        value: 100,
        currency: 'USD',
      },
      insurance: [
        {
          sequence: 1,
          focal: true,
          coverage: {
            reference: `Coverage/${coverageId}`,
          },
        },
      ],
      meta: {
        tag: [],
      },
    }) as unknown as Claim;

  it('asks for as many coverages as the page has, rather than leaning on the default page size', async () => {
    const claims = Array.from({ length: 60 }, (_unused, index) =>
      claimWithCoverage(`claim-${index}`, `coverage-${index}`)
    );
    const { oystehr, search } = stubEnrichClient();

    await enrichAndMapClaims({
      oystehr,
      claims,
      includedResources: [],
    });

    const coverageParams = coverageSearchParams(search);
    expect(paramNamed(coverageParams, '_count')?.value).toBe('60');
  });

  it('asks for each coverage once when claims share one', async () => {
    const { oystehr, search } = stubEnrichClient();

    await enrichAndMapClaims({
      oystehr,
      claims: [claimWithCoverage('claim-1', 'coverage-1'), claimWithCoverage('claim-2', 'coverage-1')],
      includedResources: [],
    });

    const coverageParams = coverageSearchParams(search);
    expect(paramNamed(coverageParams, '_id')?.value).toBe('coverage-1');
    expect(paramNamed(coverageParams, '_count')?.value).toBe('1');
  });

  it('asks only for the coverage fields the row renders', async () => {
    const { oystehr, search } = stubEnrichClient();

    await enrichAndMapClaims({
      oystehr,
      claims: [claimWithCoverage('claim-1', 'coverage-1')],
      includedResources: [],
    });

    expect(paramNamed(coverageSearchParams(search), '_elements')?.value).toBe('id,subscriberId');
  });

  // Shrinking the page on an _id list read only returns the head of that list, so the request has
  // to page or the member ids past the reduced count go silently missing.
  it('collects every coverage when the server refuses the first page size', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const coverages = Array.from({ length: 4 }, (_unused, index) => ({
      resourceType: 'Coverage' as const,
      id: `coverage-${index}`,
      subscriberId: `member-${index}`,
    }));
    const search = vi.fn().mockImplementation(async ({ resourceType, params }) => {
      if (resourceType !== 'Coverage') {
        return {
          entry: [],
          unbundle: () => [],
        };
      }
      const count = Number(paramNamed(params, '_count')?.value);
      if (count > 2) {
        throw new Oystehr.OystehrSdkError({
          code: 4130,
          message: 'An internal response size (7,340,032) exceeds the maximum allowed size (6,291,456).',
        });
      }
      const offset = Number(paramNamed(params, '_offset')?.value ?? 0);
      const page = coverages.slice(offset, offset + count);
      return {
        total: coverages.length,
        entry: page.map((resource) => ({
          resource,
          search: {
            mode: 'match',
          },
        })),
        unbundle: () => page,
      };
    });

    const items = await enrichAndMapClaims({
      oystehr: {
        fhir: {
          search,
        },
      } as unknown as Oystehr,
      claims: coverages.map((coverage, index) => claimWithCoverage(`claim-${index}`, coverage.id)),
      includedResources: [],
    });

    expect(items.map((item) => item.memberId)).toEqual(['member-0', 'member-1', 'member-2', 'member-3']);
  });
});

describe('fetchClaimsPageByIds', () => {
  it('asks for exactly the page it was given, with the resources the list renders', async () => {
    const { oystehr, search } = stubPageClient([makeClaim('claim-1'), makeClaim('claim-2')]);

    await fetchClaimsPageByIds({
      oystehr,
      claimIds: ['claim-1', 'claim-2'],
    });

    expect(search.mock.calls[0][0].resourceType).toBe('Claim');
    expect(search.mock.calls[0][0].params).toEqual([
      {
        name: '_id',
        value: 'claim-1,claim-2',
      },
      ...CLAIM_LIST_INCLUDE_PARAMS,
      {
        name: '_elements',
        value: CLAIM_LIST_ELEMENTS,
      },
      {
        name: '_count',
        value: '2',
      },
    ]);
  });

  // An _id search returns server order, which would scramble the newest-first union.
  it('reapplies the requested order to the server response', async () => {
    const { oystehr } = stubPageClient([makeClaim('claim-3'), makeClaim('claim-1'), makeClaim('claim-2')]);

    const { claims } = await fetchClaimsPageByIds({
      oystehr,
      claimIds: ['claim-1', 'claim-2', 'claim-3'],
    });
    expect(claims.map((c) => c.id)).toEqual(['claim-1', 'claim-2', 'claim-3']);
  });

  it('returns the included resources alongside the claims', async () => {
    const patient = {
      resourceType: 'Patient',
      id: 'patient-1',
    } as Resource;
    const { oystehr } = stubPageClient([makeClaim('claim-1'), patient]);

    const { claims, includedResources } = await fetchClaimsPageByIds({
      oystehr,
      claimIds: ['claim-1'],
    });
    expect(claims.map((c) => c.id)).toEqual(['claim-1']);
    expect(includedResources).toContainEqual(patient);
  });

  it('skips an id the server did not return rather than leaving a hole', async () => {
    const { oystehr } = stubPageClient([makeClaim('claim-2')]);

    const { claims } = await fetchClaimsPageByIds({
      oystehr,
      claimIds: ['claim-1', 'claim-2'],
    });
    expect(claims.map((c) => c.id)).toEqual(['claim-2']);
  });

  it('does not search at all for an empty page', async () => {
    const { oystehr, search } = stubPageClient([]);

    const result = await fetchClaimsPageByIds({
      oystehr,
      claimIds: [],
    });

    expect(search).not.toHaveBeenCalled();
    expect(result).toEqual({
      claims: [],
      includedResources: [],
    });
  });
});
