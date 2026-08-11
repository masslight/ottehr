import Oystehr from '@oystehr/sdk';
import { Claim, Resource } from 'fhir/r4b';
import { afterEach, describe, expect, it, Mock, vi } from 'vitest';
import {
  buildClaimSearchTextQueries,
  CLAIM_LIST_INCLUDE_PARAMS,
  CLAIM_SEARCH_TEXT_MATCH_LIMIT,
  describeClaimSearchClause,
  fetchClaimsPageByIds,
  searchClaimsBySearchText,
} from '../../../src/billing/search-billing-claims';
import { CLAIM_PCN_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';

const CLAIM_ID = '3f2b9c1a-7d4e-4a8b-9c6d-0e1f2a3b4c5d';
const MINIFIED_CLAIM_ID = '3f2b9c1a7d4e4a8b9c6d0e1f2a3b4c5d';
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

  it('restores a dash-stripped PCN into a claim id clause', () => {
    expect(clauseNames(MINIFIED_CLAIM_ID)).toEqual([
      ...NAME_CLAUSES,
      'identifier',
      'patient.identifier',
      'patient.identifier',
      '_id',
    ]);
    expect(clauseFor(MINIFIED_CLAIM_ID, '_id')).toEqual([
      {
        name: '_id',
        value: CLAIM_ID,
      },
    ]);
  });

  it('keeps the fan-out to at most eight clauses', () => {
    expect(buildClaimSearchTextQueries({ searchText: 'Smith' })).toHaveLength(8);
    expect(buildClaimSearchTextQueries({ searchText: MINIFIED_CLAIM_ID })).toHaveLength(9);
    expect(buildClaimSearchTextQueries({ searchText: CLAIM_ID })).toHaveLength(9);
    expect(
      buildClaimSearchTextQueries({
        searchText: CLAIM_ID,
      })
    ).toHaveLength(9);
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
