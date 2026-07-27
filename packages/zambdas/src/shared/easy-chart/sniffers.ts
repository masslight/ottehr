import { ICD10_SCAN } from './codes';

// ── Easy-chart narrative sniffers ────────────────────────────────────────────────────────────────
// Deterministic recovery of details the model dropped from its structured output, parsed straight
// from the narrative (planner) or the provider's command (agent). Shared by both zambdas so
// identical input charts identically through either path — these lived as per-zambda copies once
// and drifted (the speaker-label guard existed only in the planner's copy).

// Dosage-form keywords ordered most-specific first so "Oral Suspension" wins over "Suspension".
const DOSE_FORM_KEYWORDS = [
  'oral suspension',
  'oral solution',
  'oral tablet',
  'extended release tablet',
  'chewable tablet',
  'suspension',
  'solution',
  'tablet',
  'capsule',
  'liquid',
  'cream',
  'ointment',
  'drops',
  'spray',
  'injection',
  'patch',
  'inhaler',
];

export function sniffDoseForm(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const kw of DOSE_FORM_KEYWORDS) {
    if (lower.includes(kw)) {
      // Capitalize first letter for downstream display ("Suspension" not "suspension").
      return kw.charAt(0).toUpperCase() + kw.slice(1);
    }
  }
  return undefined;
}

// Scope the sniff to the RIGHT side of the medication name only, since dose forms in clinical
// prose conventionally follow the ingredient ("amoxicillin SUSPENSION 400 mg/5 mL"). A tight
// 40-char forward window avoids bleeding into the next medication's form. Looking before the
// name (e.g. amoxicillin's "suspension" landing in acetaminophen's intent) was the bug.
export function sniffDoseFormScoped(contextText: string, display: string, searchTerms: string[]): string | undefined {
  const needles = [...searchTerms, display].map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
  const contextLower = contextText.toLowerCase();
  for (const needle of needles) {
    const idx = contextLower.indexOf(needle.toLowerCase());
    if (idx === -1) continue;
    const start = idx + needle.length;
    const end = Math.min(contextText.length, start + 40);
    // First hit decides — don't bleed into the next med's window.
    return sniffDoseForm(contextText.slice(start, end));
  }
  return undefined;
}

// Ambient-scribe transcripts tag every line with a speaker label ("DOCTOR X31", "PATIENT X31",
// "Speaker 1"). When that label happens to match the ICD-10 shape (X31 → [A-TV-Z][0-9][A-Z0-9])
// the code sniffer grabs it as a diagnosis code — the single most embarrassing class of bug in
// the planner audit. Any code-shaped token that RECURS across the narrative is structural noise
// (a speaker tag), never a one-off diagnosis code: a real ICD-10 code is spelled once or twice.
// Collect those tokens (uppercased) so the sniffer and the post-parse validation both refuse them.
export function detectSpeakerLabels(narrative: string): Set<string> {
  const labels = new Set<string>();
  // 1. Token that follows a speaker role at the start of a line ("DOCTOR X31", "PATIENT X31").
  const roleRe = /^[ \t]*(?:DOCTOR|PATIENT|NURSE|PROVIDER|CLINICIAN|MA|RN|SPEAKER)\b[ \t]*([A-Za-z0-9]+)/gim;
  let m: RegExpExecArray | null;
  while ((m = roleRe.exec(narrative)) !== null) {
    if (m[1]) labels.add(m[1].toUpperCase());
  }
  // 2. Any code-shaped token recurring >= 3 times is a label/noise, not a real one-off code.
  const counts = new Map<string, number>();
  const all = narrative.match(ICD10_SCAN);
  if (all) {
    for (const t of all) {
      const u = t.toUpperCase();
      counts.set(u, (counts.get(u) ?? 0) + 1);
    }
    for (const [t, n] of counts) {
      if (n >= 3) labels.add(t);
    }
  }
  return labels;
}

// Recover an ICD-10 code the model omitted from a ~80-char window around the diagnosis name —
// narrative usually says "Acute otitis media, right ear (H66.91)" with the code immediately
// following. Candidates that are recurring speaker labels (e.g. "X31") are refused.
export function sniffIcdCodeScoped(
  contextText: string,
  display: string,
  searchTerms: string[],
  speakerLabels: Set<string>
): string | undefined {
  const needles = [display, ...searchTerms].map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
  const contextLower = contextText.toLowerCase();
  for (const needle of needles) {
    const idx = contextLower.indexOf(needle.toLowerCase());
    if (idx === -1) continue;
    const start = Math.max(0, idx - 20);
    const end = Math.min(contextText.length, idx + needle.length + 60);
    const matches = contextText.slice(start, end).match(ICD10_SCAN);
    if (matches && matches.length > 0) {
      const good = matches.find((c) => !speakerLabels.has(c.toUpperCase()));
      if (good) return good;
    }
    return undefined;
  }
  return undefined;
}

// ── Disposition-language scan ────────────────────────────────────────────────────────────────────
// Deterministic trigger for the review's disposition check (check 7). Left to the model alone the
// check fired very inconsistently (same corpus, no code change: disposition coverage swung
// 53%→36%→35%), so the review zambda scans the narrative deterministically and, on a hit with no
// disposition charted, force-includes a must-address instruction in the prompt. The scan aims for
// HIGH PRECISION — a missed pattern just leaves check 7 on its normal (model-discretion) path,
// while a false hit pushes the model toward inventing a disposition. Deliberately omitted as too
// false-positive-prone: bare "follow-up" (visit REASONS read "here for follow-up of his asthma"),
// "see your doctor" (transcripts quote past-tense dialogue), "if worse" alone (HPI: "if she lies
// down it gets worse"), and hospital-admission phrasing (history-prone: "admitted last year").
// Quoted/reported instructions ("urgent care told me to follow up here") DO fire — the model
// still owns extraction and is told to decline when the match isn't a disposition for THIS visit.
export const DISPOSITION_LANGUAGE_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  // Forward-looking follow-up: requires with/interval/as-needed/if so "here for follow-up of his
  // asthma" (the visit's reason) does not fire.
  {
    label: 'follow-up',
    re: /\bfollow\s*-?\s*up\s+(?:with\b|in\s+(?:\d|a\b|an\b|one|two|three|four|five|six|a\s+few)|as\s+needed\b|if\b)/i,
  },
  { label: 'schedule-follow-up', re: /\b(?:schedule|arrange|set\s+up)\s+(?:a\s+)?follow\s*-?\s*up\b/i },
  // "recheck" needs a time/visit anchor — mid-exam "let me recheck that ear" must not fire.
  {
    label: 'recheck',
    re: /\bre-?check\s+(?:in\s+(?:\d|a\b|one|two|three)|tomorrow\b|next\s+week\b|appointment\b|visit\b)/i,
  },
  // "return"/"come back" needs a place/interval/condition — "if the hives come back" (symptom
  // recurrence) has none of the listed continuations.
  {
    label: 'return-to-clinic',
    re: /\b(?:return|come\s+back)\s+(?:to\s+(?:the\s+)?(?:clinic|office|urgent\s+care)|to\s+see\s+us\b|here\b|in\s+(?:\d|a\b|one|two|three)|tomorrow\b|if\b|should\b|as\s+needed\b)/i,
  },
  { label: 'return-precautions', re: /\breturn\s+precautions\b/i },
  // "refer" only in its forward forms — "was referred to us by her PCP" (how they got HERE) stays out.
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

// Negation words that suppress a hit when they appear just BEFORE the match in the same clause
// ("no follow-up needed", "does not need a referral"). The lookahead keeps "no better"/"not
// improving" from counting as negations — "if no better, come back" is a POSITIVE disposition.
const DISPOSITION_NEGATION_RE =
  /\b(?:no|not|without|don'?t|doesn'?t|won'?t|declined?)\b(?!\s+(?:better|improv|relief))/i;
// Trailing suppression, scanned to the end of the SENTENCE but only for explicit dismissal
// phrases ("a follow up with cardiology was not needed", "offered a referral but the patient
// declined") — a bare trailing "not" must NOT kill "follow up if not improving".
const DISPOSITION_TRAILING_NEGATION_RE = /\b(?:not\s+(?:needed|necessary|required)|unnecessary|declined?)\b/i;

export interface DispositionLanguageMatch {
  // Label of the DISPOSITION_LANGUAGE_PATTERNS entry that fired (safe for logs/metrics — never
  // narrative text).
  pattern: string;
  // The matched narrative text, quoted back to the model in the forced instruction.
  excerpt: string;
}

export function detectDispositionLanguage(narrative: string): DispositionLanguageMatch | undefined {
  for (const { label, re } of DISPOSITION_LANGUAGE_PATTERNS) {
    // Iterate ALL occurrences — an early negated hit ("no referral needed") must not mask a later
    // positive one ("but follow up with your PCP in a week").
    const global = new RegExp(re.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = global.exec(narrative)) !== null) {
      // Leading window is clause-bounded (commas count, so "no better, come back in 3 days"
      // fires); trailing scan runs to the end of the sentence. See the negation regexes above.
      const before = narrative.slice(Math.max(0, m.index - 24), m.index);
      const leading = before.split(/[.!?\n;,]/).pop() ?? before;
      if (DISPOSITION_NEGATION_RE.test(leading)) continue;
      const after = narrative.slice(m.index + m[0].length, m.index + m[0].length + 80);
      const trailing = after.split(/[.!?\n;]/)[0];
      if (DISPOSITION_TRAILING_NEGATION_RE.test(trailing)) continue;
      return { pattern: label, excerpt: m[0] };
    }
  }
  return undefined;
}

// Recover a missing step `sourceText` from the narrative: the model reliably quotes sources for
// note/exam steps but often omits them on medications, which downgraded the provenance hover to
// "inferred" even though the drug is right there in the dictation. Deterministic fallback: pick
// the narrative sentence with the strongest word overlap with the step's display/searchTerms.
// Returns undefined when nothing plausibly matches — "inferred" stays the honest answer then.
export function recoverSourceText(narrative: string, needles: Array<string | undefined>): string | undefined {
  const words = new Set(
    needles
      .filter((n): n is string => typeof n === 'string' && !!n.trim())
      .flatMap((n) => n.toLowerCase().split(/[^a-z0-9]+/))
      .filter((w) => w.length >= 4)
  );
  if (words.size === 0) return undefined;
  const sentences = narrative.split(/(?<=[.!?])\s+/);
  let best: { sentence: string; hits: number; strong: boolean } | undefined;
  for (const sentence of sentences) {
    const sTokens = new Set(sentence.toLowerCase().split(/[^a-z0-9]+/));
    let hits = 0;
    let strong = false; // at least one specific (≥5-char) word matched, e.g. the drug name
    for (const w of words) {
      if (sTokens.has(w)) {
        hits++;
        if (w.length >= 5) strong = true;
      }
    }
    if (hits > 0 && (!best || hits > best.hits)) best = { sentence: sentence.trim(), hits, strong };
  }
  if (!best || !best.strong) return undefined;
  return best.sentence.length > 300 ? `${best.sentence.slice(0, 297)}…` : best.sentence;
}
