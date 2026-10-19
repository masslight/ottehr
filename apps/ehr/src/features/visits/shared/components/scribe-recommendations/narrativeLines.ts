// The narrative draft, and how the generator's sentences are located in it by exact text, in order. The draft
// is never split into sentences (that breaks on "5.5 mg", "Dr.", "b.i.d."); edited sentences are simply not found.

import { NarrativeLine } from 'utils/lib/easy-chart/api';
import { LocatedLine } from './types';

/** Hover notes for a recommendation's evidence, by where its quote came from. */
export const UNBACKED_LINE_NOTE = 'Not found in the transcript — the narrative said this on its own.';
/** Heads the closest transcript passage for a sentence the generator paraphrased rather than quoted. */
export const INEXACT_MATCH_NOTE = 'Inexact match — what the transcript says:';
export const PROVIDER_EVIDENCE_NOTE = 'From your edit to the narrative.';
export const TRANSCRIPT_QUOTE_NOTE = 'From the transcript.';
export const CHART_QUOTE_NOTE = 'From the chart.';

/** The generator's sentences as one paragraph: the draft as it starts, before the provider edits it. */
export const draftFromNarrative = (lines: NarrativeLine[]): string =>
  lines
    .map((line) => line.text.trim())
    .filter((text) => text !== '')
    .join(' ');

/** The narrative as the provider left it, and the string every narrative quote is located in. */
export const narrativeText = (draft: string): string => draft.trim();

/**
 * Finds the generator's sentences in the draft by exact search from a moving cursor, so matches stay in order
 * and a repeated sentence is not found twice. Edited or deleted sentences are skipped.
 */
export function locateGeneratedLines(draft: string, generated: NarrativeLine[]): LocatedLine[] {
  const located: LocatedLine[] = [];
  let cursor = 0;
  for (const original of generated) {
    const text = original.text.trim();
    if (!text) continue;
    const start = draft.indexOf(text, cursor);
    if (start < 0) continue;
    const end = start + text.length;
    located.push({ text, original, start, end });
    cursor = end;
  }
  return located;
}
