import { ChartReviewResponse, PlannedAction } from 'utils/lib/easy-chart/api';
import { STRICT_ICD10 } from 'utils/lib/easy-chart/codes';
import { detectDispositionLanguage } from 'utils/lib/easy-chart/sniffers';
import { ModelActionSchema } from '../easy-chart-shared/model-output';

const CODE = STRICT_ICD10.source.slice(1, -1);
const TRAILING_CODE = new RegExp(`\\s*\\(${CODE}\\)\\s*$`, 'i');
const LEADING_CODE = new RegExp(`^${CODE}\\s*—\\s*`, 'i');
const CODE_IN_PARENS = new RegExp(`\\((${CODE})\\)`, 'i');

/** Every meaningful word of a suggested ROS finding's symptom must appear in the dictation. */
export function rosActionIsVerbatim(action: PlannedAction, narrative: string): boolean {
  if (action.kind !== 'add-ros-finding' || typeof action.display !== 'string') return true;
  const symptom = action.display.replace(/^(denies|reports)\b[:\s-]*/i, '');
  const words = symptom
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !['the', 'any', 'and', 'her', 'his'].includes(word));
  const haystack = narrative.toLowerCase();
  return words.length > 0 && words.every((word) => haystack.includes(word));
}

const SWAP_PAIRS = [
  { add: 'add-diagnosis', remove: 'remove-diagnosis' },
  { add: 'add-medication', remove: 'remove-medication' },
] as const;

/**
 * A correction card is a remove + add pair. When a guard refuses the addition the removal goes too, or
 * the card would take a diagnosis off the chart and put nothing back.
 */
export function dropOrphanedRemovals(
  proposed: unknown[],
  guarded: PlannedAction[],
  rejected: ChartReviewResponse['rejected']
): PlannedAction[] {
  const proposedKinds = new Set(
    proposed.flatMap((item) => {
      const action = ModelActionSchema.safeParse(item);
      return action.success ? [action.data.kind] : [];
    })
  );
  let kept = guarded;
  for (const { add, remove } of SWAP_PAIRS) {
    const wasASwap = proposedKinds.has(add) && kept.some((action) => action.kind === remove);
    if (!wasASwap || kept.some((action) => action.kind === add)) continue;
    kept = kept.filter((action) => {
      if (action.kind !== remove) return true;
      rejected.push({
        kind: action.kind,
        display: action.display,
        reason: `the replacement for "${action.display}" could not be charted, so it was left in place`,
      });
      return false;
    });
  }
  return kept;
}

/**
 * True when the card's addition resolved to the code the card also removes, so applying it is a no-op.
 * A removal carries its code only in the display it copied from the chart: "Tenosynovitis (M65.051)".
 */
export function swapCancelsItself(actions: PlannedAction[]): boolean {
  const normalize = (code: string | undefined): string => (code ?? '').toUpperCase().replace(/\./g, '');
  const removed = new Set(
    actions
      .filter((action) => action.kind === 'remove-diagnosis')
      .map((action) => normalize(CODE_IN_PARENS.exec(action.display ?? '')?.[1]))
      .filter(Boolean)
  );
  return actions.some((action) => action.kind === 'add-diagnosis' && removed.has(normalize(action.code)));
}

/**
 * A review swap card (remove-diagnosis + add-diagnosis) must restate the removed diagnosis's primary
 * flag, and the model reliably omits it, which would leave the note with no primary. When the add has no
 * flag, it is read from the removed diagnosis's own entry in the chart-state text.
 */
export function carrySwapPrimaryFromChartState(actions: PlannedAction[], chartState: string | undefined): void {
  if (!chartState) return;
  const add = actions.find((action) => action.kind === 'add-diagnosis' && typeof action.isPrimary !== 'boolean');
  const remove = actions.find((action) => action.kind === 'remove-diagnosis' && typeof action.display === 'string');
  if (!add || !remove) return;

  // The removal names the diagnosis as "<display> (H66.003)" or "<code> — <display>".
  const display = (remove.display ?? '').replace(TRAILING_CODE, '').replace(LEADING_CODE, '').trim();
  if (!display) return;
  const index = chartState.toLowerCase().indexOf(display.toLowerCase());
  if (index < 0) return;

  // Only this diagnosis's own segment: every diagnosis shares one "Diagnoses:" line.
  const tail = chartState.slice(index + display.length);
  const end = tail.search(/[;\n]/);
  add.isPrimary = /\(primary\)|\[PRIMARY\]/i.test(end >= 0 ? tail.slice(0, end) : tail);
}

/**
 * A must-address instruction when the narrative states a disposition and the chart has none. Left to
 * the model alone, this check's coverage swung widely between runs of the same corpus.
 */
export function buildDispositionInstruction(narrative: string, chartState: string | undefined): string | undefined {
  if (chartState && /^\s*-?\s*disposition\b/im.test(chartState)) return undefined;
  const match = detectDispositionLanguage(narrative);
  if (!match) return undefined;
  return (
    `The dictation states a disposition or follow-up plan ("${match.excerpt.trim()}") and none is charted. ` +
    'Address check 7 explicitly: either propose the set-disposition it supports, or say nothing about ' +
    'disposition if that phrase is not a plan for THIS visit.'
  );
}
