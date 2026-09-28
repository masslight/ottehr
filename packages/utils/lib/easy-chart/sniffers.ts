// Deterministic recovery of details the model dropped, parsed from the narrative. Shared so the plan and review
// paths chart identical input identically.

import { ICD10_SCAN } from './codes';

/**
 * Speaker labels that look like ICD-10 codes ("DOCTOR X31"), for the code sniffer to ignore. A code-shaped
 * token that recurs three or more times counts as a label, since a real code appears once or twice.
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
 * Recovers an omitted ICD-10 code from a window around the diagnosis name ("Acute otitis media, right ear
 * (H66.91)"), ignoring speaker labels.
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
 * Disposition language that, with nothing charted, forces the review's disposition check. High precision on
 * purpose, since a false hit pushes the model to invent a disposition: bare "follow-up", "see your doctor" and
 * "if worse" are deliberately absent.
 */
const DISPOSITION_LANGUAGE_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
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
  // Condition-anchored, so "returning to work" and "the pain keeps returning" do not fire.
  { label: 'returning-if', re: /\breturning\s+(?:if|when)\b/i },
  // Needs both "back here" and a time, so "the hives came back" does not fire.
  {
    label: 'back-here',
    re: /\bback\s+here\s+(?:same\s+day\b|today\b|tomorrow\b|in\s+(?:\d|a\b|an\b|one|two|three|four|five|six|a\s+few))/i,
  },
  { label: 'return-precautions', re: /\breturn\s+precautions\b/i },
  // Forward forms only: "was referred to us by her PCP" describes how they got here.
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
 * Negations that suppress a hit when they sit just before the match in the same clause. The lookahead keeps
 * "no better"/"not improving" from counting, since "if no better, come back" is a positive disposition.
 */
const DISPOSITION_NEGATION_RE =
  /\b(?:no|not|without|don'?t|doesn'?t|won'?t|declined?)\b(?!\s+(?:better|improv|relief))/i;
/**
 * Trailing suppression, scanned to the end of the sentence but only for explicit dismissal ("was not needed",
 * "the patient declined"). A bare trailing "not" must not suppress "follow up if not improving".
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
    // Check every occurrence: an early negated hit ("no referral needed") must not mask a later positive one.
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
