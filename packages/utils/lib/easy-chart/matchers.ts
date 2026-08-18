// Matching a dictated finding to a catalogue leaf.
//
// The algorithm is rebuilt; the data tables it uses were not (see matcher-tables.ts — each entry is
// a word that caused a wrong match). Pure and dependency-free on purpose: the eval harness replays
// captured actions through THESE functions, which is where exam and ROS mismatches show up, and that
// replay must run offline over committed fixtures.
//
// Four guards decide the result before scoring ever does:
//   1. NEGATION — a negated query ("no wheezing") must never match the positive finding.
//   2. NORMALCY VETO — a query reporting a normal must not match the abnormal counterpart.
//   3. ANATOMY SECTION — a finding must not be filed under a different body-system card. Hits across
//      more than one card yield NO verdict, which is the conservative direction.
//   4. GENERIC-TOKEN DISCOUNTING — "pain", "swelling", "mild" can never carry a match alone.

import { ExamLeaf } from '../config-helpers/exam-leaves';
import {
  EXAM_ANATOMY_SECTION_OF,
  EXAM_DESCRIPTOR_CLASS_OF,
  EXAM_NEGATION_TOKENS,
  EXAM_QUERY_STOPWORDS,
  GENERIC_FINDING_TOKENS,
  MED_QUALIFIER_EVIDENCE,
  NORMALCY_PATTERNS,
  ROS_QUERY_STOPWORDS,
} from './matcher-tables';
import { findingPolarity } from './provenance';

export interface MatchCandidate {
  id: string;
  display: string;
  score: number;
  payload?: unknown;
}

/** Light stemmer for finding-token comparison: "wheezes"/"wheezing" must match "Wheezing". */
export function stem(token: string): string {
  return token
    .replace(/(?:ing|ed|es|s)$/i, '')
    .replace(/i$/i, 'y')
    .toLowerCase();
}

export function tokenize(text: string, stopwords: Set<string>): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !stopwords.has(token));
}

/** Expand a token through the descriptor synonym classes, so "swollen" reaches "edematous". */
function synonymKey(token: string): string {
  const cls = EXAM_DESCRIPTOR_CLASS_OF.get(token);
  return cls === undefined ? stem(token) : `syn:${cls}`;
}

/**
 * The exam card the query's anatomy points at, or undefined when it names none — or names more than
 * one, which is deliberately treated as "no verdict" rather than picking a side.
 */
export function anatomySectionOf(query: string): string | undefined {
  const sections = new Set<string>();
  for (const token of query.toLowerCase().split(/[^a-z]+/)) {
    const section = EXAM_ANATOMY_SECTION_OF[token];
    if (section) sections.add(section);
  }
  return sections.size === 1 ? [...sections][0] : undefined;
}

/** Does this query assert a normal reading rather than an abnormality? */
export function assertsNormal(query: string): boolean {
  return findingPolarity(query) === 'normal' || NORMALCY_PATTERNS.test(query);
}

export function isNegated(query: string): boolean {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  return tokens.some((token) => EXAM_NEGATION_TOKENS.has(token));
}

export interface ExamMatchOptions {
  /** All the terms to try — the display plus the model's searchTerms. Each is scored independently. */
  searchTerms?: string[];
}

/**
 * Score every exam leaf against a dictated finding. Returns the plausible ones, best first; an empty
 * result means SKIP WITH A REASON, never write a fallback.
 */
export function findExamLeafMatches(
  display: string,
  leaves: ExamLeaf[],
  options: ExamMatchOptions = {}
): MatchCandidate[] {
  // GUARD 1. A negated finding is not an abnormal finding: it must neither create one nor remove the
  // matching normal, because it AGREES with the normal.
  if (isNegated(display)) return [];

  // GUARD 2. A query reporting a normal must not match the abnormal counterpart.
  const wantsNormal = assertsNormal(display);

  // GUARD 3. Restrict to one body-system card when the query names anatomy unambiguously.
  const section = anatomySectionOf(display);

  const terms = [display, ...(options.searchTerms ?? [])].filter((t) => t?.trim());
  const scored = new Map<string, MatchCandidate>();

  for (const leaf of leaves) {
    if (section && leaf.sectionLabel !== section) continue;
    if (wantsNormal !== (leaf.polarity === 'normal')) continue;

    let best = 0;
    for (const term of terms) {
      best = Math.max(best, scoreLeaf(term, leaf));
    }
    if (best <= 0) continue;

    const existing = scored.get(leaf.field);
    if (!existing || existing.score < best) {
      scored.set(leaf.field, { id: leaf.field, display: leaf.label, score: best, payload: leaf });
    }
  }

  return [...scored.values()].sort((a, b) => b.score - a.score || a.display.localeCompare(b.display));
}

function scoreLeaf(term: string, leaf: ExamLeaf): number {
  const queryTokens = tokenize(term, EXAM_QUERY_STOPWORDS);
  if (queryTokens.length === 0) return 0;

  const leafTokens = new Set(tokenize(leaf.leafLabel, EXAM_QUERY_STOPWORDS).map(synonymKey));
  // Path tokens (the modal section, column header and group) locate the leaf; matching one is real
  // evidence, but weaker than matching the leaf's own words.
  const pathTokens = new Set(tokenize(leaf.path.join(' '), EXAM_QUERY_STOPWORDS).map(synonymKey));

  let score = 0;
  let specificHits = 0;

  for (const token of queryTokens) {
    const key = synonymKey(token);
    const generic = GENERIC_FINDING_TOKENS.has(token);
    if (leafTokens.has(key)) {
      score += generic ? 0.35 : 1;
      if (!generic) specificHits += 1;
    } else if (pathTokens.has(key)) {
      score += generic ? 0.15 : 0.5;
      if (!generic) specificHits += 1;
    }
  }

  // GUARD 4. A match anchored only on generic tokens is how "denies groin pain" charted "Denies Eye
  // pain". At least one specific token must have hit.
  if (specificHits === 0) return 0;

  // Normalise by query length so a long phrase does not out-score a precise short one, and reward a
  // leaf whose own words are fully covered.
  const coverage = score / queryTokens.length;
  const leafCoverage = leafTokens.size > 0 ? Math.min(1, score / leafTokens.size) : 0;
  return coverage * 0.7 + leafCoverage * 0.3;
}

export interface RosCatalogueEntry {
  /** Base field key, without the -denies/-reports suffix. */
  baseField: string;
  label: string;
  systemLabel: string;
}

/**
 * ROS matching. The polarity is carried in the display text ("Reports…"/"Denies…") and handled by
 * the caller — this only finds the SYMPTOM. Stopwords strip generic modifiers from both sides so a
 * symptom with no catalogue item ("loss of sensation") correctly finds nothing rather than matching
 * "Weight loss/gain" on the shared word "loss".
 */
export function findRosMatches(
  display: string,
  catalogue: RosCatalogueEntry[],
  options: ExamMatchOptions = {}
): MatchCandidate[] {
  const terms = [display, ...(options.searchTerms ?? [])].filter((t) => t?.trim());
  const results: MatchCandidate[] = [];

  for (const entry of catalogue) {
    const labelTokens = new Set(tokenize(entry.label, ROS_QUERY_STOPWORDS).map(stem));
    if (labelTokens.size === 0) continue;

    let best = 0;
    for (const term of terms) {
      const queryTokens = tokenize(term, ROS_QUERY_STOPWORDS).map(stem);
      if (queryTokens.length === 0) continue;
      const hits = queryTokens.filter((token) => labelTokens.has(token)).length;
      if (hits === 0) continue;
      // Both directions must be reasonably covered: "chest pain" should not match "pain" on a
      // different system, and "eye pain and redness" should still find "Eye pain".
      best = Math.max(best, (hits / queryTokens.length) * 0.5 + (hits / labelTokens.size) * 0.5);
    }
    if (best > 0) {
      results.push({
        id: entry.baseField,
        display: `${entry.systemLabel}: ${entry.label}`,
        score: best,
        payload: entry,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score || a.display.localeCompare(b.display));
}

/**
 * Right drug, right form (requirements section 9).
 *
 * A medication catalogue is full of product names that carry a SITE or INDICATION in the name:
 * "Clotrimazole AF Athlete's Foot Cream", "Miconazole Vaginal Cream", "Neomycin Otic Solution". They
 * are the same active ingredient, so a name-similarity search ranks them interchangeably — and the top
 * hit for "antifungal cream" on a vaginal candidiasis visit was an athlete's-foot product. Charting it
 * is a wrong route and a wrong indication, not a cosmetic mismatch.
 *
 * A candidate whose name carries such a qualifier is only eligible when the REQUEST TEXT shows evidence
 * for it. Absence of evidence DISQUALIFIES the candidate rather than merely lowering its score — a
 * demoted candidate still wins when it is the only one, which is exactly the case that hurt.
 *
 * Only qualifiers in the table are judged: an unlisted word is not treated as a qualifier at all, so a
 * plain "Amoxicillin 500 mg" is never filtered. High precision over coverage, deliberately.
 */
export function medicationQualifierSupported(candidateName: string, requestText: string): boolean {
  const evidence = requestText.toLowerCase();
  for (const token of tokenize(candidateName, new Set())) {
    const required = MED_QUALIFIER_EVIDENCE[token];
    if (!required) continue;
    // Substring, not token, matching on the evidence side: the table's entries are deliberately stems
    // ("vagin", "ophthalm", "prurit") so they hit the inflections a visit actually uses.
    if (!required.some((word) => evidence.includes(word))) return false;
  }
  return true;
}

/**
 * Drop catalogue candidates whose product name claims a site or indication the request does not support.
 * An empty result is honest: the caller reports it as "nothing matched", and charting a wrong-route
 * product would be worse than asking the provider to name the one they meant.
 */
export function filterUnsupportedQualifiers<T extends { display: string }>(candidates: T[], requestText: string): T[] {
  return candidates.filter((candidate) => medicationQualifierSupported(candidate.display, requestText));
}
