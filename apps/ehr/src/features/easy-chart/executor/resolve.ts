// Catalogue resolution: turn a list of candidate matches into one of three outcomes.
//
//   exactly one confident match  → write it, mark AI-authored
//   several near-equal matches   → ASK (interactive) or auto-pick and mark low-confidence (bulk)
//   nothing                      → skip WITH A REASON
//
// The bulk/interactive split matters: during a whole-plan run a provider will not click through
// dozens of pickers, so ambiguity auto-picks the top match and tints it amber. When they typed one
// request and are watching, ambiguity asks.

import { CatalogueMatch, HandlerContext, PickerRequest } from './types';

/**
 * A second candidate scoring within this fraction of the top one means the pick is genuinely
 * ambiguous. Discovered by tuning, not derived: below it the top match is reliably right, above it
 * the runner-up is right often enough that guessing is wrong.
 */
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

export interface ResolvedPick {
  match: CatalogueMatch;
  /** True when the provider did not choose this — the run auto-picked it from several candidates. */
  lowConfidence: boolean;
  note?: string;
}

/**
 * Resolve to something writable, or undefined when there is nothing to write. `undefined` always
 * means the caller must SKIP WITH A REASON — never write a fallback.
 */
export async function resolvePick(
  matches: CatalogueMatch[],
  context: HandlerContext,
  request: Omit<PickerRequest, 'options'>
): Promise<ResolvedPick | undefined> {
  const resolution = classifyMatches(matches);
  if (resolution.kind === 'none') return undefined;
  if (resolution.kind === 'confident') return { match: resolution.match, lowConfidence: false };

  if (context.mode === 'bulk' && !request.destructive) {
    return {
      match: resolution.match,
      lowConfidence: true,
      note: `auto-picked from ${resolution.alternatives.length} near-equal matches — verify`,
    };
  }

  // Interactive, or destructive at any time: ask. With several plausible matches for a removal we
  // never delete the first substring match.
  const chosen = await context.ask({ ...request, options: resolution.alternatives });
  return chosen ? { match: chosen, lowConfidence: false } : undefined;
}

/** A catalogue query built from what the model said, for the picker's "you asked for…" line. */
export const describeQuery = (display: string | undefined): string => display?.trim() || 'this item';
