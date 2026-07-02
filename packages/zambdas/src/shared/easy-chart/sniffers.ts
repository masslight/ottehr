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
