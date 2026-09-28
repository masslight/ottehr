// Provenance and polarity guards run over every action. A `sourceText` quote that does not really occur in the
// narrative is dropped (the item shows as inferred), because a fabricated citation is worse than none. Negated
// and normal findings agree with the normal, so they never chart as abnormalities.

/**
 * Loose comparison for quote checking: case, punctuation and whitespace are noise, wording is not.
 * Deliberately does not stem or drop words, so a paraphrase still fails.
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

/**
 * What to look for: the quote as the loose comparison sees it, then without the quotation marks, periods
 * or ellipses a model puts around a quote ("\"sore throat.\"", "...for two days").
 */
function quoteTargets(quote: string): string[] {
  const full = normalizeForQuoteMatch(quote);
  const bare = full.replace(/^['".\s]+|['".\s]+$/g, '');
  return [full, bare].filter((target, index, all) => target !== '' && all.indexOf(target) === index);
}

/** True when `quote` really occurs in `narrative`. Empty quotes are not claims and pass trivially. */
export function quoteOccursInNarrative(quote: string | undefined, narrative: string): boolean {
  if (!quote || !quote.trim()) return true;
  const haystack = normalizeForQuoteMatch(narrative);
  return quoteTargets(quote).some((target) => haystack.includes(target));
}

/** Longer quotes are cut down: a whole highlighted paragraph points at nothing. */
const QUOTE_CLAMP_CHARS = 200;

/**
 * The quote when it really occurs in the narrative, else undefined (shown as inferred). An over-long quote is
 * clamped and re-verified, since a cut is a new quote; the full quote stands if the cut one fails.
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
 * Offsets of `quote` in the original `narrative` (`end` exclusive), using the same loose comparison as
 * `quoteOccursInNarrative`, so a server-verified quote can be highlighted exactly as pasted.
 */
export function locateQuote(narrative: string, quote: string): { start: number; end: number } | undefined {
  const targets = quoteTargets(quote);
  if (targets.length === 0) return undefined;

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

  for (const target of targets) {
    const at = normalized.indexOf(target);
    if (at >= 0) return { start: starts[at], end: ends[at + target.length - 1] };
  }
  return undefined;
}

/**
 * Words that structurally negate a clinical finding. "absent" is deliberately excluded: "absent bowel sounds"
 * negates a normal, which makes it an abnormality.
 */
export const NEGATION_TOKENS = new Set(['no', 'non', 'not', 'without', 'denies', 'denied', 'negative']);

/**
 * Phrases that assert normality without a negation word. "Soft" counts only next to "abdomen": a soft abdomen
 * is normal, soft-tissue swelling is not.
 */
const NORMALCY_PHRASES =
  /\b(?:clear\s+to\s+auscultation|ctab|clear\b|normal\b|unremarkable\b|intact\b|within\s+normal\s+limits|wnl\b|nontender\b|non-tender\b|nondistended\b|non-distended\b|reactive\b|supple\b|symmetric(?:al)?\b|abdomen\s+(?:is\s+)?soft\b|soft\s+abdomen\b)/i;

/**
 * 'negated' ("no wheezing"), 'normal' ("lungs clear") or 'positive' (an abnormality is present). Only
 * 'positive' may create an abnormal exam finding or remove a template's matching normal.
 */
export function findingPolarity(display: string): 'positive' | 'negated' | 'normal' {
  const text = display.toLowerCase();
  const tokens = text.split(/[^a-z]+/).filter(Boolean);
  // A negator anywhere negates the finding, including a trailing "negative" ("straight leg raise negative").
  if (tokens.some((t) => NEGATION_TOKENS.has(t))) return 'negated';
  if (/\bno\s|\bnon-/.test(text)) return 'negated';
  if (NORMALCY_PHRASES.test(text)) return 'normal';
  return 'positive';
}

/**
 * Polarity from the display text ("Reports…"/"Denies…"), which is what the chart stores; the model's `finding`
 * enum is only a fallback.
 */
export function rosPolarity(display: string, finding?: string): 'reports' | 'denies' | undefined {
  const text = display.trim().toLowerCase();
  if (text.startsWith('denies')) return 'denies';
  if (text.startsWith('reports')) return 'reports';
  if (finding === 'denies' || finding === 'reports') return finding;
  return undefined;
}

/** Words that carry no evidence of which passage a quote came from, excluded from the overlap score. */
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
 * Minimum share of a quote's content words found in one stretch. Low on purpose because a paraphrase keeps the
 * nouns and swaps the verbs; the two-word minimum keeps a single shared noun from counting.
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
 * The stretch of `narrative` closest to a paraphrased `quote`, widened to sentence or speaker-turn bounds and
 * capped. Undefined below PASSAGE_MIN_SCORE, which marks the quote as unsupported rather than paraphrased.
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
  // A paraphrase is rarely tighter than the quote and often looser, so try 1x, 1.5x and 2x its length.
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
