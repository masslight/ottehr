// Catalogue resolution: one confident match is written; several near-equal matches ask the provider
// (interactive) or auto-pick the top one and mark it low confidence (bulk); no match skips with a reason.

import { CatalogueMatch, HandlerContext, PickerRequest } from './types';

/** A runner-up scoring within this fraction of the top match makes the pick ambiguous. Tuned, not derived. */
export const AMBIGUITY_RATIO = 0.75;

export type Resolution =
  | { kind: 'confident'; match: CatalogueMatch }
  | { kind: 'ambiguous'; match: CatalogueMatch; alternatives: CatalogueMatch[] }
  | { kind: 'none' };

/** Classify a candidate list without deciding what to do about it. */
export function classifyMatches(matches: CatalogueMatch[]): Resolution {
  const ranked = [...matches].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top) return { kind: 'none' };

  const contenders = ranked.slice(1).filter((m) => top.score > 0 && m.score / top.score >= AMBIGUITY_RATIO);
  if (contenders.length === 0) return { kind: 'confident', match: top };
  return { kind: 'ambiguous', match: top, alternatives: [top, ...contenders] };
}

interface ResolvedPick {
  match: CatalogueMatch;
  /** The run auto-picked this among several candidates; the provider did not choose it. */
  lowConfidence: boolean;
  note?: string;
}

/** Something writable, or undefined, which means skip with a reason rather than write a fallback. */
export async function resolvePick(
  matches: CatalogueMatch[],
  context: HandlerContext,
  request: Omit<PickerRequest, 'options'>
): Promise<ResolvedPick | undefined> {
  const resolution = classifyMatches(matches);
  if (resolution.kind === 'none') return undefined;
  if (resolution.kind === 'confident') return { match: resolution.match, lowConfidence: false };

  if (context.mode === 'bulk') {
    return {
      match: resolution.match,
      lowConfidence: true,
      note: `auto-picked from ${resolution.alternatives.length} near-equal matches — verify`,
    };
  }

  // Interactive: ask.
  const chosen = await context.ask({ ...request, options: resolution.alternatives });
  return chosen ? { match: chosen, lowConfidence: false } : undefined;
}

/** What the model said, for reasons and the picker's "you asked for…" line. */
export const describeQuery = (display: string | undefined): string => display?.trim() || 'this item';
