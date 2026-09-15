import { locateQuote } from 'utils/lib/easy-chart/provenance';
import { NarrativeSegment, ScribeRecommendation } from './types';

/**
 * The transcript cut into runs: plain text, and the phrases the recommendations were drawn from, each run
 * carrying the ids of every recommendation that cites it.
 *
 * This is the "narrative" the panel tells the visit back with. The model does not write one; it writes a
 * verbatim `sourceText` on each action, which the server has already checked against the transcript. So the
 * story is the transcript itself, and the highlights are the evidence — the provider reads what was said and
 * finds the item it produced, or reads an item and sees the words behind it, from either end.
 *
 * Two citations can overlap (the HPI quotes a sentence, the diagnosis quotes a phrase inside it), so the text
 * is cut at every citation boundary and each piece carries every id whose quote covers it; neighbouring
 * pieces with the same ids are joined back so one highlight is one span.
 */
export function buildTranscriptNarrative(
  transcript: string,
  recommendations: ScribeRecommendation[]
): NarrativeSegment[] {
  const text = transcript ?? '';
  if (!text.trim()) return [];

  const ranges: { start: number; end: number; id: string }[] = [];
  for (const rec of recommendations) {
    if (!rec.evidence) continue;
    const at = locateQuote(text, rec.evidence);
    if (at && at.end > at.start) ranges.push({ ...at, id: rec.id });
  }
  if (ranges.length === 0) return [{ text }];

  const bounds = [...new Set([0, text.length, ...ranges.flatMap((range) => [range.start, range.end])])].sort(
    (a, b) => a - b
  );
  const segments: NarrativeSegment[] = [];
  for (let i = 0; i + 1 < bounds.length; i += 1) {
    const [start, end] = [bounds[i], bounds[i + 1]];
    const ids = ranges.filter((range) => range.start <= start && range.end >= end).map((range) => range.id);
    const piece = text.slice(start, end);
    const last = segments[segments.length - 1];
    if (last && sameIds(last.itemIds, ids)) {
      last.text += piece;
    } else {
      segments.push(ids.length > 0 ? { text: piece, itemIds: ids } : { text: piece });
    }
  }
  return segments;
}

const sameIds = (a: string[] | undefined, b: string[]): boolean =>
  (a ?? []).length === b.length && (a ?? []).every((id, index) => id === b[index]);
