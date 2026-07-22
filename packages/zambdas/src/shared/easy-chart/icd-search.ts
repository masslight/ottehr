import Oystehr from '@oystehr/sdk';

// ── Easy-chart ICD-10 search (Oystehr terminology service) ─────────────────────────────────────
// The canonical ICD-10 source for easy-chart code resolution: the same platform search the EHR's
// diagnosis picker uses (see useICD10SearchNew), so server-side resolution and the client UI agree
// on what a query returns. The deterministic guards in codes.ts consume plain {code, display}
// candidates through an injected IcdSearchFn, keeping them pure and unit-testable against fixture
// search functions.

export interface Icd10Code {
  code: string;
  display: string;
}

// The injected search dependency: `limit` is the maximum number of candidates the caller wants to
// consider. Implementations may return a few extra rows (register-variant fan-out, below) but must
// preserve ranking order — resolution takes the first non-contradicting candidate.
export type IcdSearchFn = (query: string, limit: number) => Promise<Icd10Code[]>;

// Query phrasings that EXPLICITLY ask for an asymptomatic history/status code. Clinical
// narratives use "history of X" loosely for the CURRENT complaint's backstory ("history of
// recurrent ingrown hairs" = an active ingrown hair), so bare "history of" deliberately does not
// count — only unambiguous chart shorthand does. Shared with the easy-chart history-code gate
// (see codes.ts) so callers agree on what "explicit" means.
export const EXPLICIT_HISTORY_INTENT =
  /\b(?:personal|family|past(?: medical)?) history\b|\bpmh\b|\bhx\b|\bh\/o\b|\bstatus[- ]post\b|\bs\/p\b/i;

// Latin/anatomical ↔ common-name synonyms for the fuzzy word match used when JUDGING a candidate
// display (the etiology-repair step must decide whether a replacement display still names the same
// base condition, in the same register-tolerant way providers dictate). Conservative, unambiguous
// pairs only; multi-word synonyms are checked against the whole display string.
const WORD_SYNONYMS: Record<string, string[]> = {
  cervical: ['neck'],
  neck: ['cervical'],
  lumbar: ['lower back', 'lumbosacral'],
  thoracic: ['chest wall'],
  renal: ['kidney'],
  kidney: ['renal'],
  cardiac: ['heart'],
  heart: ['cardiac'],
  hepatic: ['liver'],
  liver: ['hepatic'],
  hives: ['urticaria'],
  thigh: ['lower limb'],
  paronychia: ['cellulitis'],
  breast: ['mastitis', 'mammary'],
  toe: ['foot'],
  palm: ['hand'],
  allergic: ['allergy'],
  allergy: ['allergic'],
  amoxicillin: ['penicillin', 'penicillins'],
  augmentin: ['penicillin', 'penicillins'],
  drug: ['medicament', 'medication'],
  calf: ['lower limb', 'lower leg'],
  shin: ['lower leg', 'lower limb'],
  // Trunk sites: ICD-10 files superficial tailbone/buttock injuries under "lower back and pelvis"
  // (S30.x) — the site word must still count as naming that region.
  coccyx: ['lower back'],
  coccygeal: ['lower back'],
  tailbone: ['coccyx', 'lower back'],
  sacrum: ['lower back'],
  sacral: ['lower back'],
  buttock: ['lower back'],
  buttocks: ['lower back'],
  bruise: ['contusion'],
  bruised: ['contusion'],
  // Organism/etiology register: providers say "candidal"/"yeast" while the ICD displays say
  // "Candidiasis" (a live review failure charted A54.02 "Gonococcal vulvovaginitis" for a yeast
  // narrative when this bridge was missing).
  candidal: ['candid'],
  candidiasis: ['candid'],
  yeast: ['candid'],
  // Compound-site words the displays split apart ("Candidiasis of vulva and vagina").
  vulvovaginitis: ['vulva', 'vagina'],
};

// Exported for the easy-chart etiology guard (codes.ts), whose repair step must judge candidate
// displays with register-tolerant word semantics (see WORD_SYNONYMS).
export function wordMatchesDisplay(searchWord: string, displayWords: string[], normalizedDisplay: string): boolean {
  if (displayWords.some((w) => w.includes(searchWord))) return true;
  for (const syn of WORD_SYNONYMS[searchWord] ?? []) {
    if (syn.includes(' ') ? normalizedDisplay.includes(syn) : displayWords.some((w) => w.includes(syn))) return true;
  }
  return false;
}

// ── Query-register expansion — TEMPORARY upstream shim ─────────────────────────────────────────
// The Oystehr terminology service is our own product; its lay-register synonym gaps are being
// reported upstream for a proper service-side fix (reference: "Oystehr terminology ICD-10 synonym
// gaps" report, 2026-07-22). This client-side expansion exists ONLY until the service's synonym
// layer handles these registers itself — remove entries as the service starts covering them, and
// keep the vocabulary intentionally small: only entries with a demonstrated live failure or probe
// gap, never a comprehensive lay-term list. Current entries (probed 2026-07): "yeast infection"
// returns no candida code in the platform's top results, and "candidal …" was the register behind
// the live A54.02-for-yeast review failure.
export const REGISTER_QUERY_SYNONYMS: Record<string, string[]> = {
  yeast: ['candidiasis'],
  candidal: ['candidiasis'],
};

// The original query plus one rewritten variant per (matched vocabulary word × synonym), via
// whole-word token substitution. Pure; deliberately not combinatorial across multiple matched
// words — each variant rewrites one vocabulary word.
export function expandQueryRegisters(query: string): string[] {
  const out = [query];
  for (const [word, substitutes] of Object.entries(REGISTER_QUERY_SYNONYMS)) {
    if (!new RegExp(`\\b${word}\\b`, 'i').test(query)) continue;
    for (const substitute of substitutes) {
      const variant = query.replace(new RegExp(`\\b${word}\\b`, 'gi'), substitute);
      if (!out.some((q) => q.toLowerCase() === variant.toLowerCase())) out.push(variant);
    }
  }
  return out;
}

// Page size the platform reliably serves (same value the EHR picker requests); larger caller
// limits (category-sibling enumeration in codes.ts) are satisfied by cursor paging.
const TERMINOLOGY_PAGE_SIZE = 100;

// Thin wrapper over the platform ICD-10 search, normalized to the {code, display} candidate shape
// the guards consume. Same call shape as the EHR picker (searchType/synonyms/specialty), so both
// ends of the product see identical results. Failures intentionally propagate: a dead terminology
// service must fail the invocation (wrapHandler surfaces it), exactly as a failed local-index load
// did before the swap — resolution silently continuing without the canonical source would let
// unvalidated codes through.
export async function searchIcd10ViaTerminology(oystehr: Oystehr, query: string, limit: number): Promise<Icd10Code[]> {
  const out: Icd10Code[] = [];
  let cursor: string | undefined;
  while (out.length < limit) {
    const resp = await oystehr.terminology.searchIcd10({
      query,
      searchType: 'all',
      includeSynonyms: true,
      specialty: ['urgent-care'],
      limit: Math.min(TERMINOLOGY_PAGE_SIZE, limit - out.length),
      ...(cursor ? { cursor } : {}),
    });
    const page = resp.codes ?? [];
    for (const c of page) out.push({ code: c.code, display: c.display });
    cursor = resp.metadata?.nextCursor ?? undefined;
    if (!cursor || page.length === 0) break;
  }
  return out;
}

// Register-expansion layer over any backend search: fan out the original query plus its register
// variants, then merge + dedupe by code preserving first-seen order (the original query's results
// first, so the platform's own ranking still wins whenever it produced anything). The merged list
// may exceed `limit` by the appended variant hits — that is the point: variant results are the
// category defense for queries the platform's synonym layer misses.
export function createExpandedIcdSearch(backend: IcdSearchFn): IcdSearchFn {
  return async (query, limit) => {
    const perVariant = await Promise.all(expandQueryRegisters(query).map((variant) => backend(variant, limit)));
    const seen = new Set<string>();
    const merged: Icd10Code[] = [];
    for (const results of perVariant) {
      for (const c of results) {
        if (!seen.has(c.code)) {
          seen.add(c.code);
          merged.push(c);
        }
      }
    }
    return merged;
  };
}

// Warm-invocation memoization (same pattern as the M2M token cache): a plan resolving several
// diagnoses repeats queries (category enumerations especially), and repeated plans in a warm
// container repeat them again. Module scope is safe because a zambda process serves one Oystehr
// project. The IN-FLIGHT promise is cached so concurrent duplicates share one call; a rejected
// promise evicts itself so failures are never served from cache. Bounded by insertion-order
// eviction.
const searchCache = new Map<string, Promise<Icd10Code[]>>();
const SEARCH_CACHE_MAX_ENTRIES = 300;

export function createTerminologyIcdSearch(oystehr: Oystehr): IcdSearchFn {
  const expanded = createExpandedIcdSearch((query, limit) => searchIcd10ViaTerminology(oystehr, query, limit));
  return (query, limit) => {
    const key = `${query.trim().toLowerCase()}|${limit}`;
    const cached = searchCache.get(key);
    if (cached) return cached;
    const pending = expanded(query, limit).catch((e) => {
      searchCache.delete(key);
      throw e;
    });
    searchCache.set(key, pending);
    if (searchCache.size > SEARCH_CACHE_MAX_ENTRIES) {
      const oldest = searchCache.keys().next().value;
      if (oldest !== undefined) searchCache.delete(oldest);
    }
    return pending;
  };
}
