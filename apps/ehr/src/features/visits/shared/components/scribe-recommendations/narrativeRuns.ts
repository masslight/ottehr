import { NarrativeSegment } from './types';

/**
 * `text` cut at every range boundary, each piece carrying the ids of the ranges that cover it; adjacent
 * pieces with the same ids are joined, so one highlight is one span.
 */
export function cutRuns(text: string, ranges: { start: number; end: number; id: string }[]): NarrativeSegment[] {
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
