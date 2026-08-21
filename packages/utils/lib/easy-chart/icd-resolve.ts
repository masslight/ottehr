// The diagnosis-code resolution pipeline: hint → confirm → rank → sharpen → repair.
//
// THE INVARIANT: no code reaches the note unless the canonical terminology actually returned it, AND
// the charted {code, display} pair comes from ONE row. Never a model-supplied code under a searched
// display — that is how a note ends up asserting a condition whose code says something else.
//
// The step this pipeline exists for is RANKING. Confirming that the model's code exists is a weaker
// check than it looks: "Other acute sinusitis" (J01.80) is a real, billable code, so an existence
// check waves it through even when the visit describes plain acute sinusitis (J01.90) and the right row
// sits two places down the search the guard already ran. Resolution therefore takes the first
// NON-CONTRADICTING candidate rather than trusting the hint, and then tries to sharpen it.
//
// Pure: the terminology search is injected, so every branch here is unit-testable against fixtures.

import {
  ETIOLOGY_QUALIFIER_EVIDENCE,
  isIcd10Shaped,
  supportedEtiologyQualifiers,
  unsupportedContextQualifiers,
  unsupportedEtiologyQualifiers,
} from './codes';
import {
  CODE_DISPLAY_BOILERPLATE,
  contradictsAnatomy,
  contradictsHistoryContext,
  contradictsInjuryRegion,
  contradictsQualifiers,
  displaysOverlap,
  sharesAnyMeaningfulWord,
  wordMatchesDisplay,
} from './icd-contradictions';

export interface Icd10Row {
  code: string;
  display: string;
}

/**
 * The injected search. `limit` is the maximum number of candidates the caller wants to consider;
 * implementations may return extra rows (register-variant fan-out) but MUST preserve ranking order —
 * resolution takes the first non-contradicting candidate.
 */
export type IcdSearchFn = (query: string, limit: number) => Promise<Icd10Row[]>;

/**
 * How deep to look. Text and code searches take the first non-contradicting candidate, so a few dozen
 * ranked rows suffice. The category-sibling enumeration must instead see the WHOLE 3-character
 * category (S93 alone has 336 billable codes), so it pages far deeper; a category larger than the cap
 * degrades safely to "no upgrade".
 */
export const SEARCH_LIMIT = 50;
export const CATEGORY_SIBLING_LIMIT = 1000;

const LATERALITY_VALUES = ['left', 'right', 'bilateral'];
const RECURRENCE_INTENT = /\b(recurrent|recurring|frequent|repeated)\b/i;
/**
 * Displays phrase the side inconsistently ("…, unspecified ear" vs "…, bilateral" with no noun), so
 * these filler nouns may differ between otherwise-identical siblings without meaning a different
 * condition.
 */
const SIDE_NOUN_SLACK = new Set(['ear', 'ears', 'eye', 'eyes', 'side']);

/** Digits are load-bearing ("stage 0" vs "stage 1"), so a letters-only split would make numerically
 * distinct siblings look base-identical. */
function displayWords(display: string): Set<string> {
  return new Set(
    display
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  );
}

function baseTokens(display: string, neutral: string[]): Set<string> {
  const out = displayWords(display);
  neutral.forEach((word) => out.delete(word));
  return out;
}

function differOnlyBySideNouns(a: Set<string>, b: Set<string>): boolean {
  for (const word of a) if (!b.has(word) && !SIDE_NOUN_SLACK.has(word)) return false;
  for (const word of b) if (!a.has(word) && !SIDE_NOUN_SLACK.has(word)) return false;
  return true;
}

/**
 * One attribute dimension: find same-category siblings whose display carries `want` (and none of
 * `forbid`) and equals the current display once the dimension's words are set aside. Exactly one such
 * sibling upgrades; zero or several keep the current code. Never cross-condition, never a downgrade.
 */
async function upgradeOneDimension(
  searchIcd: IcdSearchFn,
  current: Icd10Row,
  want: string,
  forbid: string[],
  neutral: string[]
): Promise<Icd10Row> {
  const category = current.code.slice(0, 3);
  const siblings = await searchIcd(category, CATEGORY_SIBLING_LIMIT);
  const base = baseTokens(current.display, neutral);
  const candidates = siblings.filter((candidate) => {
    // The startsWith re-check drops display-text matches the search mixed into a category query.
    if (!candidate.code.startsWith(category) || candidate.code === current.code) return false;
    const words = displayWords(candidate.display);
    if (!words.has(want) || forbid.some((word) => words.has(word))) return false;
    return differOnlyBySideNouns(base, baseTokens(candidate.display, neutral));
  });
  return candidates.length === 1 ? { code: candidates[0].code, display: candidates[0].display } : current;
}

/**
 * The model charts the base/unspecified variant when the narrative names laterality ("left ankle") or
 * recurrence ("frequent ear infections") — attributes ICD-10 encodes as sibling codes inside the same
 * 3-character category (H66.90 "…, unspecified ear" vs H66.92 "…, left ear"). Dimensions apply in
 * sequence, so a narrative naming both chains two single-attribute steps (H66.009 → H66.002 → H66.005).
 */
export async function upgradeCodeSpecificity(
  searchIcd: IcdSearchFn,
  current: Icd10Row,
  intentTexts: Array<string | undefined>
): Promise<Icd10Row> {
  const intent = intentTexts
    .filter((text): text is string => typeof text === 'string' && !!text.trim())
    .join(' ')
    .toLowerCase();
  const intentWords = new Set(intent.split(/[^a-z]+/));
  let out = current;

  // Exactly one side named across the intent texts — two or more means conflicting, so keep — and the
  // validated code encodes none.
  const sides = LATERALITY_VALUES.filter((value) => intentWords.has(value));
  if (sides.length === 1 && !LATERALITY_VALUES.some((value) => displayWords(out.display).has(value))) {
    out = await upgradeOneDimension(
      searchIcd,
      out,
      sides[0],
      LATERALITY_VALUES.filter((value) => value !== sides[0]),
      [...LATERALITY_VALUES, 'unspecified']
    );
  }

  // Base comparison neutralises only "recurrent", so a candidate may not smuggle in a laterality the
  // current code lacks.
  if (RECURRENCE_INTENT.test(intent) && !displayWords(out.display).has('recurrent')) {
    out = await upgradeOneDimension(searchIcd, out, 'recurrent', [], ['recurrent']);
  }
  return out;
}

/**
 * ONE deterministic repair attempt for a code whose display carries aetiology qualifiers the evidence
 * does not support: search with the display stripped of the unsupported tokens — each evidence-
 * SUPPORTED qualifier tried as a prefix first, the bare stripped display last — and accept the first
 * candidate that (a) carries no unsupported qualifier itself, (b) keeps every base condition token,
 * (c) keeps the original laterality, and (d) can stand alone. No candidate means the caller drops it.
 *
 * Why repair before refusing: the review once proposed A54.02 (gonococcal) for a narrative documenting
 * budding yeast, and H65.06 (serous) for a bulging purulent AOM. The condition was right both times
 * and only the qualifier was wrong, so refusing outright threw away a correct finding.
 */
export async function repairUnsupportedEtiology(
  searchIcd: IcdSearchFn,
  flagged: { code?: string; display: string },
  evidence: string
): Promise<Icd10Row | undefined> {
  const unsupported = new Set(unsupportedEtiologyQualifiers(flagged.display, evidence));
  const words = flagged.display
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const stripped = words.filter((word) => !unsupported.has(word));
  const strippedQuery = stripped.join(' ');
  // Base condition tokens every replacement must keep — without them a same-organism code for a
  // DIFFERENT condition ("Candidal stomatitis") could impersonate the repair.
  const base = stripped.filter(
    (word) => word.length >= 4 && !CODE_DISPLAY_BOILERPLATE.has(word) && !(word in ETIOLOGY_QUALIFIER_EVIDENCE)
  );
  if (base.length === 0 || !strippedQuery) return undefined;
  const side = LATERALITY_VALUES.find((value) => words.includes(value));
  const queries = [
    ...supportedEtiologyQualifiers(flagged.display, evidence).map((qualifier) => `${qualifier} ${strippedQuery}`),
    strippedQuery,
  ];

  for (const query of queries) {
    const results = await searchIcd(query, SEARCH_LIMIT);
    const accepted = results.find((candidate) => {
      if (flagged.code && candidate.code === flagged.code) return false;
      const normalized = candidate.display.toLowerCase();
      if (normalized.includes('in diseases classified elsewhere')) return false;
      if (unsupportedEtiologyQualifiers(candidate.display, evidence).length > 0) return false;
      if (side && !displayWords(candidate.display).has(side)) return false;
      const candidateWords = normalized.split(/\s+/);
      return base.every((token) => wordMatchesDisplay(token, candidateWords, normalized));
    });
    if (accepted) return { code: accepted.code, display: accepted.display };
  }
  return undefined;
}

function consistent(intentText: string, row: Icd10Row, narrative?: string): boolean {
  return (
    !contradictsQualifiers(intentText, row.display) &&
    !contradictsAnatomy(intentText, row.display) &&
    !contradictsInjuryRegion(intentText, row.code) &&
    !contradictsHistoryContext(intentText, row.code, row.display) &&
    // Care context is checked against the NARRATIVE, not the intent phrase: an obstetric or
    // surgical-complication code is wrong because the VISIT was neither, and the model's short display
    // would never mention it either way.
    unsupportedContextQualifiers(row.display, narrative ?? intentText).length === 0
  );
}

/**
 * Resolve a diagnosis-like action to one terminology row, or nothing.
 *
 * Returning nothing is a legitimate answer: a query whose results ALL contradict the intent yields
 * undefined rather than its top result, because attaching a code the guard calls anatomically wrong is
 * worse than letting the client's picker resolve by display.
 */
export async function resolveIcd(
  searchIcd: IcdSearchFn,
  suggestedCode: string | undefined,
  display: string,
  searchTerms: string[],
  sourceText?: string,
  narrative?: string
): Promise<Icd10Row | undefined> {
  const intentTexts = [display, ...searchTerms, sourceText];
  const code = suggestedCode?.trim().toUpperCase();

  // 1. Exact-lookup the model's code. The happy path needs no ranking — but a real code can still be
  //    the WRONG code (the model once hinted H00.012, right LOWER eyelid, for a dictated left UPPER
  //    stye), so the hint has to survive the consistency predicates and share vocabulary with the
  //    intent before it is trusted.
  if (isIcd10Shaped(code)) {
    const byCode = await searchIcd(code!, SEARCH_LIMIT);
    const exact = byCode.find((row) => row.code.toUpperCase() === code);
    if (exact && consistent(display, exact, narrative) && displaysOverlap(display, exact.display)) {
      return upgradeCodeSpecificity(searchIcd, { code: exact.code, display: exact.display }, intentTexts);
    }
  }

  // 2. Text search by display, then each search term, taking the top non-contradicting row. The
  //    platform ranking can surface a cross-organ code — "retained foreign body" once returned the
  //    EYELID code for a palm splinter — so the same sanity applies here.
  for (const query of [display, ...searchTerms]) {
    if (!query?.trim()) continue;
    const results = await searchIcd(query.trim(), SEARCH_LIMIT);
    // The overlap floor is what stops an unrelated top row being charted: the predicates above only
    // catch a candidate that CONTRADICTS the intent, and a condition with nothing in common contradicts
    // nothing. See sharesAnyMeaningfulWord for the case that made this necessary.
    const accepted = results.find(
      (row) => consistent(display, row, narrative) && sharesAnyMeaningfulWord(display, row.display)
    );
    if (accepted) {
      return upgradeCodeSpecificity(searchIcd, { code: accepted.code, display: accepted.display }, intentTexts);
    }
  }

  // 3. Nothing valid — the caller drops the code and the client picker resolves by display.
  return undefined;
}
