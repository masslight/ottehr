import { Bundle, Claim } from 'fhir/r4b';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildClaimSearchTextQueries,
  CLAIM_SEARCH_TEXT_MATCH_LIMIT,
  collectClaimSearchBatch,
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
