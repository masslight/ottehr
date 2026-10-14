// Matches a dictated exam or ROS finding to a catalogue leaf. Kept pure so the eval harness can replay captured
// actions offline. Guards run before scoring: polarity (negated or normal findings match only normal leaves),
// anatomy section, and generic tokens that can never carry a match alone.

import { ExamLeaf } from '../config-helpers/exam-leaves';
import { InPersonRosConfig } from '../ottehr-config/review-of-systems/in-person.config';
import {
  EXAM_ANATOMY_SECTION_OF,
  EXAM_DESCRIPTOR_CLASS_OF,
  EXAM_QUERY_STOPWORDS,
  GENERIC_FINDING_TOKENS,
  MED_QUALIFIER_EVIDENCE,
  NORMALCY_PATTERNS,
  ROS_QUERY_STOPWORDS,
} from './matcher-tables';
import { findingPolarity, NEGATION_TOKENS } from './provenance';

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

/** Abbreviations the catalogue uses (every TM leaf says "TM"). Applied after stemming, so "TMs" matches too. */
const EXAM_ABBREVIATIONS: Record<string, string> = { tm: 'tympanic' };

/** Expand a token through the descriptor synonym classes, so "swollen" reaches "edematous". */
function synonymKey(token: string): string {
  const cls = EXAM_DESCRIPTOR_CLASS_OF.get(token);
  if (cls !== undefined) return `syn:${cls}`;
  const stemmed = stem(token);
  return EXAM_ABBREVIATIONS[stemmed] ?? stemmed;
}

/**
 * Tokens that name the finding, without negators: polarity is settled before scoring, and left in, "no
 * wheezing" would match "No signs of respiratory distress" on "no".
 */
function findingTokens(text: string): string[] {
  return tokenize(text, EXAM_QUERY_STOPWORDS).filter((token) => !NEGATION_TOKENS.has(token));
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

/** True unless the query reports a positive abnormality; a negated finding ("no wheezing") counts as normal. */
export function assertsNormal(query: string): boolean {
  return findingPolarity(query) !== 'positive' || NORMALCY_PATTERNS.test(query);
}

export interface ExamMatchOptions {
  /** The model's extra search terms, each scored independently alongside the display. */
  searchTerms?: string[];
}

/**
 * Score every exam leaf against a dictated finding. Returns the plausible ones, best first; an empty
 * result means skip with a reason, never write a fallback.
 */
export function findExamLeafMatches(
  display: string,
  leaves: ExamLeaf[],
  options: ExamMatchOptions = {}
): MatchCandidate[] {
  // Polarity guard: a negated finding ("non-tender") or an asserted normal ("lungs clear") may match only the
  // normal side of the card, and an abnormality only the abnormal side.
  const wantsNormal = assertsNormal(display);

  // Anatomy guard: restrict to one body-system card when the query names anatomy unambiguously.
  const section = anatomySectionOf(display);

  const terms = [display, ...(options.searchTerms ?? [])].filter((t) => t?.trim());
  const scored = new Map<string, MatchCandidate>();

  for (const leaf of leaves) {
    if (section && leaf.sectionLabel !== section) continue;
    if (wantsNormal !== (leaf.polarity === 'normal')) continue;

    let best = 0;
    for (const term of terms) {
      best = Math.max(best, scoreLeaf(term, leaf, wantsNormal));
    }
    if (best <= 0) continue;

    const existing = scored.get(leaf.field);
    if (!existing || existing.score < best) {
      scored.set(leaf.field, { id: leaf.field, display: leaf.label, score: best, payload: leaf });
    }
  }

  return [...scored.values()].sort((a, b) => b.score - a.score || a.display.localeCompare(b.display));
}

function scoreLeaf(term: string, leaf: ExamLeaf, wantsNormal: boolean): number {
  const queryTokens = findingTokens(term);
  if (queryTokens.length === 0) return 0;

  const leafWords = findingTokens(leaf.leafLabel);
  const leafTokens = new Set(leafWords.map(synonymKey));
  const leafSize = leafTokens.size;
  // A one-word normal ("Nontender") also answers to its bare finding, because "non-tender" and "no tenderness"
  // tokenize to "tender"; the polarity filter already keeps those off the abnormal Tender leaf.
  if (leaf.polarity === 'normal') {
    for (const word of leafWords) {
      const bare = /^non(.{3,})$/.exec(word)?.[1];
      if (bare) leafTokens.add(synonymKey(bare));
    }
  }
  // For a one-word normal leaf ("Soft", "Nontender") a generic token is the finding itself, not a qualifier,
  // so a hit on it counts as specific. This applies to the leaf's own words only, never its path.
  const wholeLeafIsOneWord = wantsNormal && leaf.polarity === 'normal' && leafWords.length === 1;
  // Path tokens (the modal section, column header and group) locate the leaf; matching one is real
  // evidence, but weaker than matching the leaf's own words.
  const pathTokens = new Set(tokenize(leaf.path.join(' '), EXAM_QUERY_STOPWORDS).map(synonymKey));

  let score = 0;
  let specificHits = 0;

  for (const token of queryTokens) {
    const key = synonymKey(token);
    const generic = GENERIC_FINDING_TOKENS.has(token);
    if (leafTokens.has(key)) {
      const specific = !generic || wholeLeafIsOneWord;
      score += specific ? 1 : 0.35;
      if (specific) specificHits += 1;
    } else if (pathTokens.has(key)) {
      score += generic ? 0.15 : 0.5;
      if (!generic) specificHits += 1;
    }
  }

  // Generic-token guard: at least one specific token must hit, or "groin pain" could match "Eye pain".
  if (specificHits === 0) return 0;

  // Normalise by query length so a long phrase does not out-score a precise short one, and reward a
  // leaf whose own words are fully covered.
  const coverage = score / queryTokens.length;
  const leafCoverage = leafSize > 0 ? Math.min(1, score / leafSize) : 0;
  return coverage * 0.7 + leafCoverage * 0.3;
}

export interface RosCatalogueEntry {
  /** Base field key, without the -denies/-reports suffix. */
  baseField: string;
  label: string;
  systemLabel: string;
}

/**
 * One entry per ROS symptom, keyed by its base field. Shared so the client catalogue, the eval harness and the
 * recommendations panel all resolve against the same entries.
 */
export function buildRosCatalogue(config: typeof InPersonRosConfig = InPersonRosConfig): RosCatalogueEntry[] {
  return Object.values(config).flatMap((system) =>
    Object.entries(system.items).map(([baseField, item]) => ({
      baseField,
      label: item.label,
      systemLabel: system.label,
    }))
  );
}

/**
 * Finds the ROS symptom only; the caller handles the "Reports…"/"Denies…" polarity. Generic modifiers are
 * stopwords on both sides, so "loss of sensation" finds nothing rather than "Weight loss/gain".
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
 * False when the product name claims a site or indication (MED_QUALIFIER_EVIDENCE) the request gives no
 * evidence for. It disqualifies rather than demotes: a demoted candidate still wins when it is the only one.
 */
export function medicationQualifierSupported(candidateName: string, requestText: string): boolean {
  const evidence = requestText.toLowerCase();
  for (const token of tokenize(candidateName, new Set())) {
    const required = MED_QUALIFIER_EVIDENCE[token];
    if (!required) continue;
    // Substring match: the evidence entries are stems ("vagin", "ophthalm") so they catch inflections.
    if (!required.some((word) => evidence.includes(word))) return false;
  }
  return true;
}

/**
 * Drops candidates whose product name claims an unsupported site or indication. May return empty: the caller
 * then reports "nothing matched" rather than charting a wrong-route product.
 */
export function filterUnsupportedQualifiers<T extends { display: string }>(candidates: T[], requestText: string): T[] {
  return candidates.filter((candidate) => medicationQualifierSupported(candidate.display, requestText));
}
