// Provenance verification and negation detection — two guards that run over every action before the
// client ever sees it.
//
// PROVENANCE: each action's `sourceText` claims to be a verbatim phrase from the narrative. Models
// paraphrase and stitch list items together with ellipses, and a fabricated citation in a medical
// record is worse than none — a provider auditing the note by hovering each item would be reading
// quotes nobody said. So the quote is checked against the narrative and DROPPED when it isn't really
// there; the item is then honestly marked *inferred*.
//
// NEGATION: "no wheezing", "lungs clear", "non-tender" is not an abnormal finding. It must neither
// create one nor remove the matching normal, because it AGREES with the normal. Match on polarity,
// not on the keyword.

/**
 * Loose comparison for quote checking: case, punctuation and whitespace are noise, wording is not.
 * Deliberately does NOT stem or drop words — the point is to catch paraphrase.
 */
function normalizeForQuoteMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}'"/%.-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when `quote` really occurs in `narrative`. Empty quotes are not claims and pass trivially. */
export function quoteOccursInNarrative(quote: string | undefined, narrative: string): boolean {
  if (!quote || !quote.trim()) return true;
  return normalizeForQuoteMatch(narrative).includes(normalizeForQuoteMatch(quote));
}

/**
 * Return the action's `sourceText` when it is genuinely present in the narrative, otherwise
 * undefined — which the UI renders as *inferred*. Never returns a quote the narrative does not
 * contain.
 */
export function verifiedSourceText(sourceText: string | undefined, narrative: string): string | undefined {
  const quote = sourceText?.trim();
  if (!quote) return undefined;
  return quoteOccursInNarrative(quote, narrative) ? quote : undefined;
}

/** Words that structurally negate a clinical finding. */
export const NEGATION_TOKENS = new Set(['no', 'non', 'not', 'without', 'denies', 'denied', 'absent', 'negative']);

/**
 * Phrases that assert normality without a negation word. "Lungs clear" is a normal, not an abnormal
 * finding, and it must not remove the matching normal either.
 */
const NORMALCY_PHRASES =
  /\b(?:clear\s+to\s+auscultation|ctab|clear\b|normal\b|unremarkable\b|intact\b|within\s+normal\s+limits|wnl\b|nontender\b|non-tender\b|nondistended\b|non-distended\b|reactive\b|supple\b|symmetric(?:al)?\b)/i;

/**
 * The polarity of a finding as written.
 *  - 'negated'  — the narrative says the finding is ABSENT ("no wheezing", "without crackles").
 *  - 'normal'   — the narrative asserts a normal ("lungs clear", "neuro intact").
 *  - 'positive' — an abnormality is actually present.
 *
 * Only 'positive' may create an abnormal exam finding or remove a template's matching normal.
 */
export function findingPolarity(display: string): 'positive' | 'negated' | 'normal' {
  const text = display.toLowerCase();
  const tokens = text.split(/[^a-z]+/).filter(Boolean);
  // A negator anywhere before the last token negates the finding: "no wheezing", "denies fever",
  // "lungs without crackles". A trailing "negative" ("straight leg raise negative") counts too.
  if (tokens.some((t) => NEGATION_TOKENS.has(t))) return 'negated';
  if (/\bno\s|\bnon-/.test(text)) return 'negated';
  if (NORMALCY_PHRASES.test(text)) return 'normal';
  return 'positive';
}

/** Convenience: may this display text produce an abnormal exam finding at all? */
export function isChartableAbnormalFinding(display: string): boolean {
  return findingPolarity(display) === 'positive';
}

/**
 * ROS carries its polarity in the display text ("Reports…" / "Denies…"). Any structured `finding`
 * enum the model emits is a SECONDARY signal only — the text is what the provider reads and what the
 * chart stores.
 */
export function rosPolarity(display: string, finding?: string): 'reports' | 'denies' | undefined {
  const text = display.trim().toLowerCase();
  if (text.startsWith('denies')) return 'denies';
  if (text.startsWith('reports')) return 'reports';
  if (finding === 'denies' || finding === 'reports') return finding;
  return undefined;
}
