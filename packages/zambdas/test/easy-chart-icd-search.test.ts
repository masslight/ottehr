import Oystehr from '@oystehr/sdk';
import { describe, expect, it, vi } from 'vitest';
import { resolveIcd } from '../src/shared/easy-chart/codes';
import {
  createExpandedIcdSearch,
  createTerminologyIcdSearch,
  expandQueryRegisters,
  Icd10Code,
  IcdSearchFn,
  searchIcd10ViaTerminology,
} from '../src/shared/easy-chart/icd-search';

// ── Query-register expansion (temporary upstream shim — see REGISTER_QUERY_SYNONYMS) ───────────
describe('expandQueryRegisters', () => {
  it('returns only the original query when no vocabulary word is present', () => {
    expect(expandQueryRegisters('acute pharyngitis')).toEqual(['acute pharyngitis']);
  });

  it('rewrites the lay register: yeast → candidiasis', () => {
    expect(expandQueryRegisters('yeast infection')).toEqual(['yeast infection', 'candidiasis infection']);
  });

  it('rewrites the adjective register: candidal → candidiasis', () => {
    expect(expandQueryRegisters('candidal vulvovaginitis unspecified')).toEqual([
      'candidal vulvovaginitis unspecified',
      'candidiasis vulvovaginitis unspecified',
    ]);
  });

  it('substitutes whole words only, case-insensitively', () => {
    expect(expandQueryRegisters('yeasty discharge')).toEqual(['yeasty discharge']);
    expect(expandQueryRegisters('Yeast infection')).toEqual(['Yeast infection', 'candidiasis infection']);
  });
});

// Backend keyed by exact query; unknown queries return [].
const backendOf = (fixtures: Record<string, Icd10Code[]>): IcdSearchFn => {
  return async (query, limit) => (fixtures[query.toLowerCase()] ?? []).slice(0, limit);
};

// The live-probed gap this layer exists for: the platform's "yeast infection" top hits contain NO
// candida code. Fixtures mirror that probe; the expansion must append the candida rows the
// rewritten query surfaces, without disturbing the platform's own ranking for the original query.
const N76_0 = { code: 'N76.0', display: 'Acute vaginitis' };
const N76_2 = { code: 'N76.2', display: 'Acute vulvitis' };
const B37_9 = { code: 'B37.9', display: 'Candidiasis, unspecified' };

describe('createExpandedIcdSearch', () => {
  it('appends variant-query results after the original results, deduped by code', async () => {
    const expanded = createExpandedIcdSearch(
      backendOf({
        'yeast infection': [N76_0, N76_2],
        // Overlapping N76.0 proves first-seen dedupe keeps the original occurrence.
        'candidiasis infection': [B37_9, N76_0],
      })
    );
    expect(await expanded('yeast infection', 5)).toEqual([N76_0, N76_2, B37_9]);
  });

  it('is a passthrough for queries with no register variants', async () => {
    const backend = vi.fn(
      backendOf({ 'acute pharyngitis': [{ code: 'J02.9', display: 'Acute pharyngitis, unspecified' }] })
    );
    const expanded = createExpandedIcdSearch(backend);
    expect(await expanded('acute pharyngitis', 5)).toEqual([
      { code: 'J02.9', display: 'Acute pharyngitis, unspecified' },
    ]);
    expect(backend).toHaveBeenCalledTimes(1);
  });

  it('lets resolution reach a candida code for a lay-register display the platform alone cannot resolve', async () => {
    const expanded = createExpandedIcdSearch(
      backendOf({
        'yeast infection': [],
        'candidiasis infection': [B37_9],
      })
    );
    const resolved = await resolveIcd(expanded, undefined, 'Yeast infection', []);
    expect(resolved?.code).toBe('B37.9');
  });
});

// ── Terminology wrapper: platform call shape + cursor paging + failure propagation ─────────────
type SearchIcd10Params = Parameters<Oystehr['terminology']['searchIcd10']>[0];

const fakeOystehr = (
  impl: (params: SearchIcd10Params) => Promise<{ codes: Icd10Code[]; metadata: { nextCursor: string | null } }>
): { oystehr: Oystehr; searchIcd10: ReturnType<typeof vi.fn> } => {
  const searchIcd10 = vi.fn(impl);
  return { oystehr: { terminology: { searchIcd10 } } as unknown as Oystehr, searchIcd10 };
};

const row = (n: number): Icd10Code => ({ code: `T${n}`, display: `row ${n}` });

describe('searchIcd10ViaTerminology', () => {
  it('uses the same call shape as the EHR picker', async () => {
    const { oystehr, searchIcd10 } = fakeOystehr(async () => ({
      codes: [B37_9],
      metadata: { nextCursor: null },
    }));
    expect(await searchIcd10ViaTerminology(oystehr, 'candidiasis', 50)).toEqual([B37_9]);
    expect(searchIcd10).toHaveBeenCalledWith({
      query: 'candidiasis',
      searchType: 'all',
      includeSynonyms: true,
      specialty: ['urgent-care'],
      limit: 50,
    });
  });

  it('pages via cursor when the caller asks for more than one page', async () => {
    const pages: Record<string, { codes: Icd10Code[]; next: string | null }> = {
      start: { codes: Array.from({ length: 100 }, (_, i) => row(i)), next: 'c1' },
      c1: { codes: Array.from({ length: 100 }, (_, i) => row(100 + i)), next: 'c2' },
      c2: { codes: Array.from({ length: 36 }, (_, i) => row(200 + i)), next: null },
    };
    const { oystehr, searchIcd10 } = fakeOystehr(async (params) => {
      const page = pages[params.cursor ?? 'start'];
      return { codes: page.codes.slice(0, params.limit), metadata: { nextCursor: page.next } };
    });
    const results = await searchIcd10ViaTerminology(oystehr, 'S93', 1000);
    expect(results).toHaveLength(236);
    expect(results[0]).toEqual(row(0));
    expect(results[235]).toEqual(row(235));
    expect(searchIcd10).toHaveBeenCalledTimes(3);
    expect(searchIcd10.mock.calls[1][0]).toMatchObject({ cursor: 'c1', limit: 100 });
  });

  it('stops at the requested limit even when more pages exist', async () => {
    const { oystehr, searchIcd10 } = fakeOystehr(async (params) => ({
      codes: Array.from({ length: params.limit ?? 100 }, (_, i) => row(i)),
      metadata: { nextCursor: 'more' },
    }));
    expect(await searchIcd10ViaTerminology(oystehr, 'gout', 50)).toHaveLength(50);
    expect(searchIcd10).toHaveBeenCalledTimes(1);
    expect(searchIcd10.mock.calls[0][0]).toMatchObject({ limit: 50 });
  });

  it('propagates service failures instead of swallowing them', async () => {
    const { oystehr } = fakeOystehr(async () => {
      throw new Error('terminology down');
    });
    await expect(searchIcd10ViaTerminology(oystehr, 'gout', 50)).rejects.toThrow('terminology down');
  });
});

// ── Warm-invocation memoization ────────────────────────────────────────────────────────────────
// NOTE: the cache is module-scope (shared across createTerminologyIcdSearch instances within this
// test file's module registry), so each test uses distinct queries.
describe('createTerminologyIcdSearch memoization', () => {
  it('serves repeated queries from cache, normalizing case/whitespace', async () => {
    const { oystehr, searchIcd10 } = fakeOystehr(async () => ({
      codes: [{ code: 'M10.9', display: 'Gout, unspecified' }],
      metadata: { nextCursor: null },
    }));
    const search = createTerminologyIcdSearch(oystehr);
    expect(await search('gout', 50)).toEqual([{ code: 'M10.9', display: 'Gout, unspecified' }]);
    expect(await search('Gout ', 50)).toEqual([{ code: 'M10.9', display: 'Gout, unspecified' }]);
    expect(searchIcd10).toHaveBeenCalledTimes(1);
    // A different limit is a different cache entry (deeper category enumeration must not be
    // short-changed by a cached shallow result).
    await search('gout', 1000);
    expect(searchIcd10).toHaveBeenCalledTimes(2);
  });

  it('never caches a failure', async () => {
    let calls = 0;
    const { oystehr, searchIcd10 } = fakeOystehr(async () => {
      calls++;
      if (calls === 1) throw new Error('transient');
      return { codes: [B37_9], metadata: { nextCursor: null } };
    });
    const search = createTerminologyIcdSearch(oystehr);
    await expect(search('candidiasis of skin', 50)).rejects.toThrow('transient');
    expect(await search('candidiasis of skin', 50)).toEqual([B37_9]);
    expect(searchIcd10).toHaveBeenCalledTimes(2);
  });
});
