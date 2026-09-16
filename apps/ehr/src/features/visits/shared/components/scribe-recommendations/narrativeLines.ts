// The narrative as one paragraph the provider edits, and how the generator's sentences — and so the
// transcript snippets behind them — are found again inside it.
//
// The draft is the source of truth: it is what the editor shows, what the planner is sent as the provider's
// corrections, and the string a recommendation's quote is located in, so offsets line up by construction. The generator's sentences are
// not tracked as the provider types; they are LOCATED in the draft afterwards, by exact text and in order.
// Nothing here splits the draft into sentences (that breaks on "5.5 mg", "Dr.", "b.i.d."): a sentence the
// provider has changed or removed is simply not found, and the draft outside the found sentences is theirs.
//
// Pure, on purpose. The store keeps the draft and the generated lines, and the editor and the analysis both
// read them, so the facts they share (the text as sent, where each generated sentence sits in it) live here.

import { NarrativeLine } from 'utils/lib/easy-chart/api';
import { LocatedLine } from './types';

/**
 * What the row's hover says for evidence drawn from a sentence the generator said on its own, the provider
 * wrote, or — for a quote the planner took from the transcript itself — the transcript's own words.
 */
export const UNBACKED_LINE_NOTE = 'Not found in the transcript — the narrative said this on its own.';
export const PROVIDER_EVIDENCE_NOTE = 'From your edit to the narrative.';
export const TRANSCRIPT_QUOTE_NOTE = 'From the transcript.';

/** The generator's sentences as one paragraph: the draft as it starts, before the provider edits it. */
export const draftFromNarrative = (lines: NarrativeLine[]): string =>
  lines
    .map((line) => line.text.trim())
    .filter((text) => text !== '')
    .join(' ');

/** The narrative as the provider left it, and the string every narrative quote is located in. */
export const narrativeText = (draft: string): string => draft.trim();

/**
 * The generator's sentences found in the draft, in order: a moving cursor and an exact search for each,
 * so a sentence is only found after the one before it and a repeated sentence is not found twice. A miss
 * (the provider changed or deleted it) is skipped; the search carries on from where the last hit ended.
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
