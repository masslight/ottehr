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
 * A quote longer than this is cut down. Asked for "a few words to one sentence", the model sometimes quotes a
 * whole paragraph, and a paragraph highlighted in the narrative and repeated in a tooltip points at nothing.
 */
const QUOTE_CLAMP_CHARS = 200;

/**
 * Return the action's `sourceText` when it is genuinely present in the narrative, otherwise
 * undefined — which the UI renders as *inferred*. Never returns a quote the narrative does not
 * contain.
 *
 * An over-long quote is clamped: cut at the first sentence end after the limit, or at the limit on a word
 * boundary when the rest is one long sentence, and re-verified — a cut is a new quote, and the loose
 * comparison is not guaranteed to accept a prefix of what it accepted whole. The full quote stands when the
 * cut one fails.
 */
export function verifiedSourceText(sourceText: string | undefined, narrative: string): string | undefined {
  const quote = sourceText?.trim();
  if (!quote) return undefined;
  if (!quoteOccursInNarrative(quote, narrative)) return undefined;
  if (quote.length <= QUOTE_CLAMP_CHARS) return quote;
  const clamped = clampQuote(quote);
  return clamped !== quote && quoteOccursInNarrative(clamped, narrative) ? clamped : quote;
}

/** The first sentence end at or after the limit, else the last word boundary before it. */
function clampQuote(quote: string): string {
  const sentenceEnd = /[.!?](?=\s|$)/g;
  sentenceEnd.lastIndex = QUOTE_CLAMP_CHARS;
  const end = sentenceEnd.exec(quote);
  if (end) return quote.slice(0, end.index + 1).trim();
  const space = quote.lastIndexOf(' ', QUOTE_CLAMP_CHARS);
  return (space > 0 ? quote.slice(0, space) : quote.slice(0, QUOTE_CLAMP_CHARS)).trim();
}

/** A character class the loose comparison keeps; everything else is a separator. Mirrors normalizeForQuoteMatch. */
const QUOTE_MATCH_KEPT = /[\p{L}\p{N}'"/%.-]/u;

/**
 * Where `quote` occurs in `narrative`, as offsets into the ORIGINAL text.
 *
 * The same loose comparison as `quoteOccursInNarrative`, applied character by character so every normalized
 * character remembers where it came from — which is what lets a quote the server verified be found again on
 * the client and highlighted in the transcript exactly as the provider pasted it, curly quotes, line breaks
 * and all. Undefined when the quote does not occur; `end` is exclusive.
 */
export function locateQuote(narrative: string, quote: string): { start: number; end: number } | undefined {
  const target = normalizeForQuoteMatch(quote);
  if (!target) return undefined;

  let normalized = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const char of narrative) {
    const from = offset;
    offset += char.length;
    const unified = char.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
    if (QUOTE_MATCH_KEPT.test(unified)) {
      // Lower-casing can lengthen a character; every piece of it points back at the same original one.
      for (const lower of unified.toLowerCase()) {
        normalized += lower;
        starts.push(from);
        ends.push(offset);
      }
    } else if (normalized.length > 0 && !normalized.endsWith(' ')) {
      normalized += ' ';
      starts.push(from);
      ends.push(offset);
    }
  }

  const at = normalized.indexOf(target);
  if (at < 0) return undefined;
  return { start: starts[at], end: ends[at + target.length - 1] };
}

/**
 * Words that structurally negate a clinical finding.
 *
 * "absent" is deliberately NOT one of them: dictated, it almost always negates a NORMAL — "absent
 * bowel sounds", "absent pulses", "absent reflexes" — which makes the finding an abnormality. Read as
 * a negation it became a normal, and the matcher then filed "absent bowel sounds" under Normal Bowel
 * Sounds.
 */
export const NEGATION_TOKENS = new Set(['no', 'non', 'not', 'without', 'denies', 'denied', 'negative']);

/**
 * Phrases that assert normality without a negation word. "Lungs clear" is a normal, not an abnormal
 * finding, and it must not remove the matching normal either. "Soft" only counts next to "abdomen":
 * a soft abdomen is a normal, soft-tissue swelling is not.
 */
const NORMALCY_PHRASES =
  /\b(?:clear\s+to\s+auscultation|ctab|clear\b|normal\b|unremarkable\b|intact\b|within\s+normal\s+limits|wnl\b|nontender\b|non-tender\b|nondistended\b|non-distended\b|reactive\b|supple\b|symmetric(?:al)?\b|abdomen\s+(?:is\s+)?soft\b|soft\s+abdomen\b)/i;

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

/**
 * Words that carry no evidence of WHICH passage a quote came from. Excluded from the overlap score, or
 * "the patient said the" would match everywhere.
 */
const PASSAGE_STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'is',
  'was',
  'are',
  'were',
  'be',
  'it',
  'that',
  'this',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'my',
  'your',
  'his',
  'her',
  'so',
  'um',
  'uh',
  'like',
  'just',
  'yeah',
  'okay',
  'ok',
  'patient',
  'provider',
  'reports',
  'denies',
  'has',
  'have',
  'had',
  'not',
  'no',
  'at',
  'as',
  'by',
]);

/**
 * Below this share of a quote's content words found together in one stretch, nothing "matches". A
 * paraphrase keeps the nouns and swaps the verbs ("completed a course of antibiotics for allergies" vs
 * "gave me some antibiotics … real bad allergies"), so the bar is deliberately low; the two-word minimum
 * below keeps a single shared noun from counting.
 */
const PASSAGE_MIN_SCORE = 0.4;
const PASSAGE_MIN_WORDS = 2;

/** Crude stem so "antibiotic"/"antibiotics", "allergy"/"allergies", "complete"/"completed" compare equal. */
const stem = (word: string): string =>
  word
    // Edge punctuation first: the loose normaliser keeps a sentence's final "." on its last word.
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .replace(/ies$/, 'y')
    .replace(/(es|s)$/, '')
    .replace(/(ed|ing)$/, '');
/** A passage is shown in a tooltip; longer than this reads as a wall, not a pointer. */
const PASSAGE_MAX_CHARS = 320;

/**
 * The stretch of `narrative` that comes CLOSEST to saying `quote`, for a quote that does not occur in it
 * verbatim — the model paraphrased ("recently completed a course of antibiotics" for "they gave me some
 * antibiotics… there's a couple more left"), and the useful thing to show a provider is what was actually
 * said, not "not found".
 *
 * Content words of the quote are scored against every window of the narrative of about the quote's
 * length; the best window is widened to sentence or speaker-turn boundaries so it reads naturally, and
 * capped. Undefined when no window reaches PASSAGE_MIN_SCORE — that is the genuinely unsupported case, and
 * it stays distinguishable from a paraphrase on purpose.
 */
export function closestPassage(narrative: string, quote: string): { text: string; score: number } | undefined {
  const contentWords = (text: string): string[] =>
    normalizeForQuoteMatch(text)
      .split(' ')
      .filter((w) => w.length > 1 && !PASSAGE_STOP_WORDS.has(w))
      .map(stem);
  const wanted = new Set(contentWords(quote));
  if (wanted.size < 2) return undefined;

  // Every word of the narrative with where it sits, so a window maps back to the original text.
  const tokens: { word: string; start: number; end: number }[] = [];
  for (const match of narrative.matchAll(/[\p{L}\p{N}'"/%.-]+/gu)) {
    const raw = normalizeForQuoteMatch(match[0]);
    if (!raw || PASSAGE_STOP_WORDS.has(raw) || raw.length <= 1) continue;
    tokens.push({ word: stem(raw), start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  }
  if (tokens.length === 0) return undefined;

  let best: { score: number; from: number; to: number } | undefined;
  // A paraphrase is rarely tighter than the quote and often looser; try the quote's length and half again.
  for (const size of [...new Set([wanted.size, Math.ceil(wanted.size * 1.5), Math.ceil(wanted.size * 2)])]) {
    const width = Math.min(Math.max(size, 3), tokens.length);
    for (let i = 0; i + width <= tokens.length; i += 1) {
      const seen = new Set<string>();
      for (let j = i; j < i + width; j += 1) if (wanted.has(tokens[j].word)) seen.add(tokens[j].word);
      if (seen.size < PASSAGE_MIN_WORDS) continue;
      const score = seen.size / wanted.size;
      if (!best || score > best.score) best = { score, from: i, to: i + width - 1 };
    }
  }
  if (!best || best.score < PASSAGE_MIN_SCORE) return undefined;

  // Widen to the enclosing sentence or speaker turn, within the cap.
  const boundary = /[.!?\n]|(?:^|\n)\s*[A-Z][a-z]+:\s/g;
  let from = tokens[best.from].start;
  let to = tokens[best.to].end;
  const before = narrative.slice(Math.max(0, from - PASSAGE_MAX_CHARS / 2), from);
  const lastBreak = Math.max(...[...before.matchAll(boundary)].map((m) => (m.index ?? 0) + m[0].length), 0);
  from = Math.max(0, from - PASSAGE_MAX_CHARS / 2) + lastBreak;
  const after = narrative.slice(to, to + PASSAGE_MAX_CHARS / 2);
  const nextBreak = after.search(/[.!?](\s|$)|\n/);
  to = nextBreak >= 0 ? to + nextBreak + 1 : Math.min(narrative.length, to + PASSAGE_MAX_CHARS / 2);
  const text = narrative.slice(from, to).replace(/\s+/g, ' ').trim();
  return text ? { text, score: best.score } : undefined;
}
