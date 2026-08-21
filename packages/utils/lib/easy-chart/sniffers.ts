// Deterministic recovery of details the model dropped, parsed straight from the narrative.
//
// Every function here exists because a model omission was cheaper to fix in code than to argue about in
// the prompt. They are shared rather than per-surface on purpose: identical input must chart identically
// through the plan and the review paths, and per-zambda copies of these already drifted once — the
// speaker-label guard existed in only one of them.

import { ICD10_SCAN } from './codes';

/**
 * Ambient transcripts tag every line with a speaker label ("DOCTOR X31", "PATIENT X31"). When the label
 * happens to match the ICD-10 shape — X31 satisfies [A-TV-Z][0-9][A-Z0-9] — a code sniffer grabs it as a
 * diagnosis code, which was the most embarrassing class of bug in the first planner audit. Any
 * code-shaped token that RECURS is structural noise, never a one-off diagnosis code: a real code is
 * spelled once or twice.
 */
export function detectSpeakerLabels(narrative: string): Set<string> {
  const labels = new Set<string>();
  const roleRe = /^[ \t]*(?:DOCTOR|PATIENT|NURSE|PROVIDER|CLINICIAN|MA|RN|SPEAKER)\b[ \t]*([A-Za-z0-9]+)/gim;
  let match: RegExpExecArray | null;
  while ((match = roleRe.exec(narrative)) !== null) {
    if (match[1]) labels.add(match[1].toUpperCase());
  }
  const counts = new Map<string, number>();
  for (const token of narrative.match(new RegExp(ICD10_SCAN.source, 'g')) ?? []) {
    const upper = token.toUpperCase();
    counts.set(upper, (counts.get(upper) ?? 0) + 1);
  }
  for (const [token, count] of counts) if (count >= 3) labels.add(token);
  return labels;
}

/**
 * Recover an ICD-10 code the model omitted, from a window around the diagnosis name — narratives
 * usually say "Acute otitis media, right ear (H66.91)" with the code right there. Recurring speaker
 * labels are refused.
 */
export function sniffIcdCodeScoped(
  contextText: string,
  display: string,
  searchTerms: string[],
  speakerLabels: Set<string>
): string | undefined {
  const needles = [display, ...searchTerms]
    .map((term) => (typeof term === 'string' ? term.trim() : ''))
    .filter(Boolean);
  const lower = contextText.toLowerCase();
  for (const needle of needles) {
    const index = lower.indexOf(needle.toLowerCase());
    if (index === -1) continue;
    const window = contextText.slice(Math.max(0, index - 20), Math.min(contextText.length, index + needle.length + 60));
    const matches = window.match(new RegExp(ICD10_SCAN.source, 'g'));
    // First located needle decides — a later mention would be a different sentence about something else.
    return matches?.find((code) => !speakerLabels.has(code.toUpperCase()));
  }
  return undefined;
}

/**
 * Deterministic trigger for the review's disposition check. Left to the model alone the check fired
 * very inconsistently — same corpus, no code change, coverage swung 53% → 36% → 35% — so the narrative
 * is scanned here and a hit with nothing charted force-includes a must-address instruction.
 *
 * Aims for HIGH PRECISION: a missed pattern only leaves the check on its normal model-discretion path,
 * while a false hit pushes the model toward INVENTING a disposition. Deliberately omitted as too
 * false-positive-prone: bare "follow-up" (visit reasons read "here for follow-up of his asthma"), "see
 * your doctor" (transcripts quote past-tense dialogue), "if worse" alone ("if she lies down it gets
 * worse"), and admission phrasing ("admitted last year"). Quoted instructions DO fire — the model still
 * owns extraction and is told to decline when the match is not a disposition for THIS visit.
 */
export const DISPOSITION_LANGUAGE_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  {
    label: 'follow-up',
    re: /\bfollow\s*-?\s*up\s+(?:with\b|in\s+(?:\d|a\b|an\b|one|two|three|four|five|six|a\s+few)|as\s+needed\b|if\b)/i,
  },
  { label: 'schedule-follow-up', re: /\b(?:schedule|arrange|set\s+up)\s+(?:a\s+)?follow\s*-?\s*up\b/i },
  // "recheck" needs a time or visit anchor — mid-exam "let me recheck that ear" must not fire.
  {
    label: 'recheck',
    re: /\bre-?check\s+(?:in\s+(?:\d|a\b|one|two|three)|tomorrow\b|next\s+week\b|appointment\b|visit\b)/i,
  },
  // "return"/"come back" needs a place, interval or condition — "if the hives come back" has none.
  {
    label: 'return-to-clinic',
    re: /\b(?:return|come\s+back)\s+(?:to\s+(?:the\s+)?(?:clinic|office|urgent\s+care)|to\s+see\s+us\b|here\b|in\s+(?:\d|a\b|one|two|three)|tomorrow\b|if\b|should\b|as\s+needed\b)/i,
  },
  { label: 'return-precautions', re: /\breturn\s+precautions\b/i },
  // Forward forms only — "was referred to us by her PCP" describes how they got HERE.
  { label: 'referral', re: /\breferral\b|\brefer(?:ring)?\s+(?:you|her|him|them|the\s+patient)\b/i },
  {
    label: 'emergency-care',
    re: /\b(?:go|going|head|proceed)\s+(?:straight\s+)?to\s+the\s+(?:er|ed|emergency)\b|\bcall\s+911\b|\bseek\s+(?:emergency|immediate|urgent)\s+(?:care|attention|medical\s+\w+)\b/i,
  },
  {
    label: 'discharge-home',
    re: /\bdischarged?\s+(?:to\s+)?home\b|\bdischarge\s+instructions\b|\bsent\s+home\s+(?:with|in)\b/i,
  },
  { label: 'call-office', re: /\bcall\s+(?:us|the\s+(?:office|clinic))\b/i },
];

/**
 * Negations that suppress a hit when they sit just BEFORE the match in the same clause. The lookahead
 * keeps "no better"/"not improving" from counting — "if no better, come back" is a POSITIVE disposition.
 */
const DISPOSITION_NEGATION_RE =
  /\b(?:no|not|without|don'?t|doesn'?t|won'?t|declined?)\b(?!\s+(?:better|improv|relief))/i;
/**
 * Trailing suppression, scanned to the end of the sentence but only for explicit dismissal ("was not
 * needed", "the patient declined"). A bare trailing "not" must NOT kill "follow up if not improving".
 */
const DISPOSITION_TRAILING_NEGATION_RE = /\b(?:not\s+(?:needed|necessary|required)|unnecessary|declined?)\b/i;

export interface DispositionLanguageMatch {
  /** Pattern label — safe for logs and metrics, never narrative text. */
  pattern: string;
  /** The matched words, quoted back to the model in the forced instruction. */
  excerpt: string;
}

export function detectDispositionLanguage(narrative: string): DispositionLanguageMatch | undefined {
  for (const { label, re } of DISPOSITION_LANGUAGE_PATTERNS) {
    // Iterate ALL occurrences: an early negated hit ("no referral needed") must not mask a later
    // positive one ("but follow up with your PCP in a week").
    const global = new RegExp(re.source, 'gi');
    let match: RegExpExecArray | null;
    while ((match = global.exec(narrative)) !== null) {
      const before = narrative.slice(Math.max(0, match.index - 24), match.index);
      // Leading window is clause-bounded, so "no better, come back in 3 days" fires.
      const leading = before.split(/[.!?\n;,]/).pop() ?? before;
      if (DISPOSITION_NEGATION_RE.test(leading)) continue;
      const after = narrative.slice(match.index + match[0].length, match.index + match[0].length + 80);
      if (DISPOSITION_TRAILING_NEGATION_RE.test(after.split(/[.!?\n;]/)[0])) continue;
      return { pattern: label, excerpt: match[0] };
    }
  }
  return undefined;
}

/**
 * Recover a missing `sourceText`: the model quotes sources reliably for note and exam steps but omits
 * them on medications, which downgraded the provenance hover to "inferred" even though the drug is right
 * there in the dictation. Picks the sentence with the strongest overlap, and requires at least one
 * specific (≥5-character) word to match — without that bar, "inferred" stays the honest answer.
 */
export function recoverSourceText(narrative: string, needles: Array<string | undefined>): string | undefined {
  const words = new Set(
    needles
      .filter((needle): needle is string => typeof needle === 'string' && !!needle.trim())
      .flatMap((needle) => needle.toLowerCase().split(/[^a-z0-9]+/))
      .filter((word) => word.length >= 4)
  );
  if (words.size === 0) return undefined;
  let best: { sentence: string; hits: number; strong: boolean } | undefined;
  for (const sentence of narrative.split(/(?<=[.!?])\s+/)) {
    const tokens = new Set(sentence.toLowerCase().split(/[^a-z0-9]+/));
    let hits = 0;
    let strong = false;
    for (const word of words) {
      if (tokens.has(word)) {
        hits++;
        if (word.length >= 5) strong = true;
      }
    }
    if (hits > 0 && (!best || hits > best.hits)) best = { sentence: sentence.trim(), hits, strong };
  }
  if (!best?.strong) return undefined;
  return best.sentence.length > 300 ? `${best.sentence.slice(0, 297)}…` : best.sentence;
}
