// Diagnosis-code resolution: accept the model's code only if it is consistent with the intent, else take the
// first non-contradicting search row, then sharpen it. A charted {code, display} pair always comes from one
// terminology row. The search is injected so every branch is unit-testable.

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
 * Implementations may return more than `limit` rows (register-variant fan-out) but must preserve ranking order,
 * because resolution takes the first non-contradicting candidate.
 */
export type IcdSearchFn = (query: string, limit: number) => Promise<Icd10Row[]>;

/**
 * Text and code searches take the first acceptable row, so a few dozen suffice. Sibling enumeration must see a
 * whole 3-character category (S93 has 336 billable codes); a larger one degrades safely to "no upgrade".
 */
export const SEARCH_LIMIT = 50;
const CATEGORY_SIBLING_LIMIT = 1000;

const LATERALITY_VALUES = ['left', 'right', 'bilateral'];
const RECURRENCE_INTENT = /\b(recurrent|recurring|frequent|repeated)\b/i;
/**
 * Filler nouns that may differ between otherwise identical siblings, since displays phrase the side
 * inconsistently ("…, unspecified ear" vs "…, bilateral").
 */
const SIDE_NOUN_SLACK = new Set(['ear', 'ears', 'eye', 'eyes', 'side']);

/** Keeps digits, so siblings such as "stage 0" and "stage 1" do not look identical. */
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
 * Upgrades to the one same-category sibling whose display adds `want` (and none of `forbid`) and otherwise
 * matches the current display. Zero or several candidates keep the current code.
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
 * Upgrades an unspecified code to the sibling encoding the laterality or recurrence the intent names (H66.90 →
 * H66.92 "left ear"). The dimensions chain, so both can apply (H66.009 → H66.002 → H66.005).
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

  // Only when exactly one side is named (more means conflicting) and the code encodes none.
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

  // Only "recurrent" is neutral here, so the candidate cannot also add a laterality.
  if (RECURRENCE_INTENT.test(intent) && !displayWords(out.display).has('recurrent')) {
    out = await upgradeOneDimension(searchIcd, out, 'recurrent', [], ['recurrent']);
  }
  return out;
}

/**
 * Re-searches a code whose aetiology qualifier the evidence does not support ("gonococcal" on a yeast visit)
 * without that qualifier, since the condition itself is usually right. Undefined means drop the code.
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
  // Base condition tokens a replacement must keep, or a same-organism code for another condition could win.
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
    // Care context is checked against the whole narrative, which the model's short display never covers.
    unsupportedContextQualifiers(row.display, narrative ?? intentText).length === 0
  );
}

/**
 * Resolves a diagnosis to one terminology row, or undefined when every candidate contradicts the intent; the
 * client picker then resolves by display, which beats attaching a wrong code.
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

  // 1. Accept the model's code if it exists, passes the consistency predicates and overlaps the display.
  if (isIcd10Shaped(code)) {
    const byCode = await searchIcd(code!, SEARCH_LIMIT);
    const exact = byCode.find((row) => row.code.toUpperCase() === code);
    if (exact && consistent(display, exact, narrative) && displaysOverlap(display, exact.display)) {
      return upgradeCodeSpecificity(searchIcd, { code: exact.code, display: exact.display }, intentTexts);
    }
  }

  // 2. Search by display, then by each search term, taking the top consistent row.
  for (const query of [display, ...searchTerms]) {
    if (!query?.trim()) continue;
    const results = await searchIcd(query.trim(), SEARCH_LIMIT);
    // The overlap floor rejects an unrelated row, which contradicts nothing and so passes the predicates.
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
