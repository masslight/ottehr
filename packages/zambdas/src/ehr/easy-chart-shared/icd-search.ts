// The terminology-backed IcdSearchFn the guards resolve codes through.
//
// Same call shape as the EHR's diagnosis picker (searchType/synonyms/specialty), so server-side
// resolution and the client UI see identical results — a code the server picked that the picker cannot
// find is a code the provider cannot correct.
//
// Failures propagate on purpose. A dead terminology service must fail the invocation rather than let
// resolution continue without the canonical source, because "continuing" means charting unvalidated
// codes. The one exception is CPT/HCPCS validation, which degrades loudly rather than dropping billing.

import Oystehr from '@oystehr/sdk';
import { expandQueryRegisters } from 'utils/lib/easy-chart/icd-contradictions';
import { Icd10Row, IcdSearchFn } from 'utils/lib/easy-chart/icd-resolve';

/** Page size the platform reliably serves — the same value the EHR picker requests. */
const TERMINOLOGY_PAGE_SIZE = 100;

/** Cursor-paged so a caller asking for a whole 3-character category actually gets it. */
export async function searchIcd10ViaTerminology(oystehr: Oystehr, query: string, limit: number): Promise<Icd10Row[]> {
  const out: Icd10Row[] = [];
  let cursor: string | undefined;
  while (out.length < limit) {
    const response = await oystehr.terminology.searchIcd10({
      query,
      searchType: 'all',
      includeSynonyms: true,
      specialty: ['urgent-care'],
      limit: Math.min(TERMINOLOGY_PAGE_SIZE, limit - out.length),
      ...(cursor ? { cursor } : {}),
    });
    const page = response.codes ?? [];
    for (const row of page) out.push({ code: row.code, display: row.display });
    cursor = response.metadata?.nextCursor ?? undefined;
    if (!cursor || page.length === 0) break;
  }
  return out;
}

/**
 * Register-expansion layer over any backend: fan out the original query plus its variants, then merge
 * and dedupe by code preserving first-seen order, so the platform's own ranking still wins wherever it
 * produced anything. The merged list may exceed `limit` by the variant hits — that is the point:
 * variant results are the defence for queries the platform's synonym layer misses.
 */
export function createExpandedIcdSearch(backend: IcdSearchFn): IcdSearchFn {
  return async (query, limit) => {
    const perVariant = await Promise.all(expandQueryRegisters(query).map((variant) => backend(variant, limit)));
    const seen = new Set<string>();
    const merged: Icd10Row[] = [];
    for (const results of perVariant) {
      for (const row of results) {
        if (!seen.has(row.code)) {
          seen.add(row.code);
          merged.push(row);
        }
      }
    }
    return merged;
  };
}

/**
 * Warm-invocation memoisation, the same pattern as the M2M token cache. One plan resolving several
 * diagnoses repeats queries — category enumerations especially, which page 1000 rows deep — and repeated
 * plans in a warm container repeat them again. Module scope is safe because a zambda process serves one
 * Oystehr project. The IN-FLIGHT promise is cached so concurrent duplicates share one call, and a
 * rejected promise evicts itself so a failure is never served from cache.
 */
const searchCache = new Map<string, Promise<Icd10Row[]>>();
const SEARCH_CACHE_MAX_ENTRIES = 300;

export function createTerminologyIcdSearch(oystehr: Oystehr): IcdSearchFn {
  const expanded = createExpandedIcdSearch((query, limit) => searchIcd10ViaTerminology(oystehr, query, limit));
  return (query, limit) => {
    const key = `${query.trim().toLowerCase()}|${limit}`;
    const cached = searchCache.get(key);
    if (cached) return cached;
    const pending = expanded(query, limit).catch((error) => {
      searchCache.delete(key);
      throw error;
    });
    searchCache.set(key, pending);
    if (searchCache.size > SEARCH_CACHE_MAX_ENTRIES) {
      const oldest = searchCache.keys().next().value;
      if (oldest !== undefined) searchCache.delete(oldest);
    }
    return pending;
  };
}
