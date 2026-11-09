// The terminology-backed ICD-10 search the guards resolve codes through: the same call shape as the
// EHR's diagnosis picker, so a code the server picks is one the provider can find and correct. Failures
// propagate: continuing without the terminology service would mean charting unvalidated codes.

import Oystehr from '@oystehr/sdk';
import { expandQueryRegisters } from 'utils/lib/easy-chart/icd-contradictions';
import { Icd10Row, IcdSearchFn } from 'utils/lib/easy-chart/icd-resolve';

/** The page size the EHR picker requests. */
const TERMINOLOGY_PAGE_SIZE = 100;

/** Cursor-paged, so a request for a whole 3-character category gets all of it. */
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
 * Searches the query and its register variants ("ear infection" → "otitis") and merges the results by
 * code in first-seen order, so the platform's own ranking wins wherever it found anything.
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
 * Memoised across warm invocations (one process serves one project). The in-flight promise is cached so
 * concurrent duplicates share a call, and a rejected one evicts itself.
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
