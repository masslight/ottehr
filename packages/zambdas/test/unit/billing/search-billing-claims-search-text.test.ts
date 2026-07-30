import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import { Bundle, Claim, Resource } from 'fhir/r4b';
import { afterEach, describe, expect, it, Mock, vi } from 'vitest';
import {
  buildClaimSearchTextQueries,
  CLAIM_LIST_INCLUDE_PARAMS,
  CLAIM_SEARCH_TEXT_MATCH_LIMIT,
  collectClaimSearchBatch,
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
    expect(clauseNames('Smith')).toEqual([...NAME_CLAUSES, 'identifier']);
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

  it('adds claim id and patient id clauses for a uuid', () => {
    expect(clauseNames(PATIENT_ID)).toEqual([...NAME_CLAUSES, 'identifier', '_id', 'patient']);
    expect(clauseFor(PATIENT_ID, 'patient')).toEqual([
      {
        name: 'patient',
        value: `Patient/${PATIENT_ID}`,
      },
    ]);
  });

  it('restores a dash-stripped PCN into a claim id clause', () => {
    expect(clauseNames(MINIFIED_CLAIM_ID)).toEqual([...NAME_CLAUSES, 'identifier', '_id']);
    expect(clauseFor(MINIFIED_CLAIM_ID, '_id')).toEqual([
      {
        name: '_id',
        value: CLAIM_ID,
      },
    ]);
  });

  it('keeps the fan-out to at most eight clauses', () => {
    expect(buildClaimSearchTextQueries({ searchText: 'Smith' })).toHaveLength(6);
    expect(buildClaimSearchTextQueries({ searchText: MINIFIED_CLAIM_ID })).toHaveLength(7);
    expect(buildClaimSearchTextQueries({ searchText: CLAIM_ID })).toHaveLength(8);
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

type BatchEntry = NonNullable<Bundle['entry']>[number];

const searchsetEntry = (claims: Claim[], total = claims.length): BatchEntry =>
  ({
    response: {
      status: '200',
      outcome: {
        id: 'ok',
      },
    },
    resource: {
      resourceType: 'Bundle',
      type: 'searchset',
      total,
      entry: claims.map((claim) => ({
        resource: claim,
        search: {
          mode: 'match',
        },
      })),
    },
  }) as unknown as BatchEntry;

const failedEntry = (): BatchEntry =>
  ({
    response: {
      status: '400',
      outcome: {
        resourceType: 'OperationOutcome',
        id: 'invalid-search',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Failed to parse search parameter chain.',
          },
        ],
      },
    },
  }) as unknown as BatchEntry;

const makeBatch = (entries: BatchEntry[]): Bundle => ({
  resourceType: 'Bundle',
  type: 'batch-response',
  entry: entries,
});

describe('collectClaimSearchBatch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('unions the clauses, deduping a claim matched by more than one', () => {
    const batch = makeBatch([
      searchsetEntry([makeClaim('claim-1', '2026-07-01T00:00:00Z')]),
      searchsetEntry([makeClaim('claim-1', '2026-07-01T00:00:00Z'), makeClaim('claim-2', '2026-07-02T00:00:00Z')]),
    ]);

    const { claims } = collectClaimSearchBatch({
      batch,
      requestUrls: ['/Claim?patient.name=Smith', '/Claim?care-team:Practitioner.name=Smith'],
    });
    expect(claims.map((c) => c.id)).toEqual(['claim-2', 'claim-1']);
  });

  it('re-sorts the union newest first, since the per-clause sort does not survive it', () => {
    const batch = makeBatch([
      searchsetEntry([makeClaim('older', '2026-01-01T00:00:00Z')]),
      searchsetEntry([makeClaim('newest', '2026-07-30T12:00:00Z'), makeClaim('middle', '2026-04-15T00:00:00Z')]),
    ]);

    const { claims } = collectClaimSearchBatch({
      batch,
      requestUrls: ['/Claim?a', '/Claim?b'],
    });
    expect(claims.map((c) => c.id)).toEqual(['newest', 'middle', 'older']);
  });

  it('sorts a claim with no lastUpdated last rather than dropping it', () => {
    const batch = makeBatch([searchsetEntry([makeClaim('undated'), makeClaim('dated', '2026-07-01T00:00:00Z')])]);

    const { claims } = collectClaimSearchBatch({
      batch,
      requestUrls: ['/Claim?a'],
    });
    expect(claims.map((c) => c.id)).toEqual(['dated', 'undated']);
  });

  it('reports the clause whose matches were truncated', () => {
    const batch = makeBatch([
      searchsetEntry([makeClaim('claim-1', '2026-07-01T00:00:00Z')], CLAIM_SEARCH_TEXT_MATCH_LIMIT),
      searchsetEntry([makeClaim('claim-2', '2026-07-02T00:00:00Z')], CLAIM_SEARCH_TEXT_MATCH_LIMIT + 1),
    ]);

    const { truncatedUrls } = collectClaimSearchBatch({
      batch,
      requestUrls: ['/Claim?at-the-limit', '/Claim?over-the-limit'],
    });
    expect(truncatedUrls).toEqual(['/Claim?over-the-limit']);
  });

  // It returns 200 even when a clause is rejected, so a silent skip would read as "no matches".
  it('logs a rejected clause and keeps the surviving ones', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const batch = makeBatch([failedEntry(), searchsetEntry([makeClaim('claim-2', '2026-07-02T00:00:00Z')])]);

    const { claims } = collectClaimSearchBatch({
      batch,
      requestUrls: ['/Claim?provider:Practitioner.name=Smith', '/Claim?patient.name=Smith'],
    });

    expect(claims.map((c) => c.id)).toEqual(['claim-2']);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toContain('/Claim?provider:Practitioner.name=Smith');
  });

  it('ignores non-Claim resources an include could add', () => {
    const batch = makeBatch([
      {
        response: {
          status: '200',
          outcome: {
            id: 'ok',
          },
        },
        resource: {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 1,
          entry: [
            {
              resource: makeClaim('claim-1', '2026-07-01T00:00:00Z'),
            },
            {
              resource: {
                resourceType: 'Patient',
                id: 'patient-1',
              },
            },
          ],
        },
      } as unknown as BatchEntry,
    ]);

    const { claims } = collectClaimSearchBatch({
      batch,
      requestUrls: ['/Claim?patient.name=Smith'],
    });
    expect(claims.map((c) => c.id)).toEqual(['claim-1']);
  });

  it('returns nothing for an empty batch', () => {
    expect(
      collectClaimSearchBatch({
        batch: makeBatch([]),
        requestUrls: [],
      })
    ).toEqual({
      claims: [],
      truncatedUrls: [],
    });
  });
});

const stubOystehr = (
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

const searchParams = (search: Mock): { name: string; value: string }[] => search.mock.calls[0][0].params;

describe('fetchClaimsPageByIds', () => {
  it('asks for exactly the page it was given, with the resources the list renders', async () => {
    const { oystehr, search } = stubOystehr([makeClaim('claim-1'), makeClaim('claim-2')]);

    await fetchClaimsPageByIds({
      oystehr,
      claimIds: ['claim-1', 'claim-2'],
    });

    expect(search.mock.calls[0][0].resourceType).toBe('Claim');
    expect(searchParams(search)).toEqual([
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

  it('reapplies the requested order to the server response', async () => {
    const { oystehr } = stubOystehr([makeClaim('claim-3'), makeClaim('claim-1'), makeClaim('claim-2')]);

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
    const { oystehr } = stubOystehr([makeClaim('claim-1'), patient]);

    const { claims, includedResources } = await fetchClaimsPageByIds({
      oystehr,
      claimIds: ['claim-1'],
    });
    expect(claims.map((c) => c.id)).toEqual(['claim-1']);
    expect(includedResources).toContainEqual(patient);
  });

  it('skips an id the server did not return rather than leaving a hole', async () => {
    const { oystehr } = stubOystehr([makeClaim('claim-2')]);

    const { claims } = await fetchClaimsPageByIds({
      oystehr,
      claimIds: ['claim-1', 'claim-2'],
    });
    expect(claims.map((c) => c.id)).toEqual(['claim-2']);
  });

  it('does not search at all for an empty page', async () => {
    const { oystehr, search } = stubOystehr([]);

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

const stubBatchClient = (): {
  oystehr: Oystehr;
  batch: Mock;
} => {
  const batch = vi.fn().mockResolvedValue(makeBatch([]));
  return {
    oystehr: {
      fhir: {
        batch,
      },
    } as unknown as Oystehr,
    batch,
  };
};

const requestedUrls = (batch: Mock): string[] =>
  batch.mock.calls.flatMap((call) => (call[0].requests as BatchInputGetRequest[]).map((r) => r.url));

const chunkSizes = (batch: Mock): number[] =>
  batch.mock.calls.map((call) => (call[0].requests as BatchInputGetRequest[]).length);

describe('searchClaimsBySearchText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies the other filters to every clause and asks for ids only', async () => {
    const { oystehr, batch } = stubBatchClient();

    await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: FILTER_PARAMS,
      withServiceDateElements: false,
    });

    const urls = requestedUrls(batch);
    expect(urls).toHaveLength(6);
    urls.forEach((url) => {
      expect(url.startsWith('/Claim?')).toBe(true);
      expect(url).toContain('_sort=-_lastUpdated');
      expect(url).toContain('_tag=https%3A%2F%2Ffhir.ottehr.com%2Fbilling%2Far-stage%7Cinsurance-payer');
      expect(url).toContain('_elements=id,meta');
      expect(url).toContain(`_count=${CLAIM_SEARCH_TEXT_MATCH_LIMIT}`);
      expect(url).toContain('_total=accurate');
      // Includes are what the page hydration is for, carrying them here would blow the batch budget
      expect(url).not.toContain('_include');
    });
    expect(urls[0]).toContain('patient.name=Smith');
    expect(urls[1]).toContain('provider:Practitioner.name=Smith');
  });

  it('asks for the fields the in-memory service date filter needs when a range is active', async () => {
    const { oystehr, batch } = stubBatchClient();

    await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: FILTER_PARAMS,
      withServiceDateElements: true,
    });

    requestedUrls(batch).forEach((url) => expect(url).toContain('_elements=id,meta,created,item'));
  });

  it('percent-encodes the search text but leaves a filter comma as the OR separator', async () => {
    const { oystehr, batch } = stubBatchClient();

    await searchClaimsBySearchText({
      oystehr,
      searchText: 'O&M Health',
      filterParams: [
        {
          name: 'insurer',
          value: 'https://payers/a,https://payers/b',
        },
      ],
      withServiceDateElements: false,
    });

    const url = requestedUrls(batch)[0];
    expect(url).toContain('patient.name=O%26M%20Health');
    expect(url).toContain('insurer=https%3A%2F%2Fpayers%2Fa,https%3A%2F%2Fpayers%2Fb');
  });

  it('chunks the clauses so one batch never takes too many connections', async () => {
    const { oystehr, batch } = stubBatchClient();

    await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: [],
      withServiceDateElements: false,
    });
    expect(chunkSizes(batch)).toEqual([4, 2]);

    batch.mockClear();
    await searchClaimsBySearchText({
      oystehr,
      searchText: CLAIM_ID,
      filterParams: [],
      withServiceDateElements: false,
    });
    expect(chunkSizes(batch)).toEqual([4, 4]);
  });

  it('unions across chunks, deduping and re-sorting newest first', async () => {
    const { oystehr, batch } = stubBatchClient();
    batch
      .mockResolvedValueOnce(makeBatch([searchsetEntry([makeClaim('older', '2026-01-01T00:00:00Z')])]))
      .mockResolvedValueOnce(
        makeBatch([
          searchsetEntry([makeClaim('newer', '2026-07-01T00:00:00Z'), makeClaim('older', '2026-01-01T00:00:00Z')]),
        ])
      );

    const claims = await searchClaimsBySearchText({
      oystehr,
      searchText: 'Smith',
      filterParams: [],
      withServiceDateElements: false,
    });
    expect(claims.map((c) => c.id)).toEqual(['newer', 'older']);
  });

  it('warns when a clause hit the match limit, so partial results are visible', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { oystehr, batch } = stubBatchClient();
    batch.mockResolvedValue(
      makeBatch([searchsetEntry([makeClaim('claim-1', '2026-07-01T00:00:00Z')], CLAIM_SEARCH_TEXT_MATCH_LIMIT + 1)])
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
    const { oystehr, batch } = stubBatchClient();

    const claims = await searchClaimsBySearchText({
      oystehr,
      searchText: '   ',
      filterParams: FILTER_PARAMS,
      withServiceDateElements: false,
    });

    expect(batch).not.toHaveBeenCalled();
    expect(claims).toEqual([]);
  });
});
