import { ExecutionMode, StepOutcome } from 'src/features/easy-chart/executor/types';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { ScribeRecommendation } from './types';

const APPLY_ORDER: Record<Exclude<ScribeRecommendation['kind'], 'action'>, number> = {
  // The template goes first so granular items land on top of it and the duplicate check sees its diagnoses.
  template: 0,
  hpi: 2,
  diagnosis: 3,
  allergy: 4,
  'vital-weight': 5,
  medication: 6,
  ros: 7,
  exam: 8,
};

/** Generic actions go last. */
const applyOrder = (rec: ScribeRecommendation): number => (rec.kind === 'action' ? 9 : APPLY_ORDER[rec.kind]);

const sortForApply = (recommendations: ScribeRecommendation[]): ScribeRecommendation[] =>
  [...recommendations].sort((a, b) => {
    const byKind = applyOrder(a) - applyOrder(b);
    if (byKind !== 0) return byKind;
    // Among diagnoses the preferred primary goes first so it is the one that ends up primary.
    if (a.kind === 'diagnosis' && b.kind === 'diagnosis') {
      return Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary));
    }
    return 0;
  });

// Zambda calls reject with a plain APIError object, not an Error, so an `instanceof Error` check would
// lose the server's wording.
export const errorMessage = (error: unknown): string =>
  getApiError({ error, defaultError: 'Something went wrong. Please try again.' });

export interface ApplyRunResult {
  applied: number;
  skipped: number;
  failed: number;
}

/** How a run reports each row's start and outcome; only the first outcome per row counts. */
export interface RunReport {
  start(id: string): void;
  settle(id: string, outcome: StepOutcome): void;
}

/**
 * Writes an already-sorted batch to the chart. `mode` says whether ambiguity may ask the provider (a single
 * row) or should auto-pick (a batch).
 */
export type RecommendationRunner = (
  recommendations: ScribeRecommendation[],
  report: RunReport,
  mode: ExecutionMode
) => Promise<void>;

/** Ids of the observations the provider still has checked in the "add these observations" stage. */
export const pendingObservationIds = (): string[] => {
  const { recommendations, itemState, chartedIds } = useScribeRecommendationsStore.getState();
  const charted = new Set(chartedIds);
  return recommendations
    .filter((rec) => {
      // The template is its own stage with its own button, so it never rides along with a batch.
      if (rec.section === 'template') return false;
      if (charted.has(rec.id)) return false;
      const item = itemState[rec.id];
      return item?.selected && item.status !== 'applied';
    })
    .map((rec) => rec.id);
};

/**
 * Applies the named recommendations sequentially, recording each outcome on its row, so later items see what
 * earlier ones wrote. `reconcile` runs once at the end regardless of failures.
 */
export const applyRecommendations = async (
  ids: string[],
  run: RecommendationRunner,
  options: { mode?: ExecutionMode; reconcile?: () => Promise<void> } = {}
): Promise<ApplyRunResult> => {
  const store = useScribeRecommendationsStore.getState();
  const wanted = new Set(ids);
  const toApply = sortForApply(
    store.recommendations.filter((rec) => wanted.has(rec.id) && store.itemState[rec.id]?.status !== 'applied')
  );
  const result: ApplyRunResult = { applied: 0, skipped: 0, failed: 0 };
  if (toApply.length === 0) return result;

  const settled = new Set<string>();
  const report: RunReport = {
    start: (id) => useScribeRecommendationsStore.getState().setItemStatus(id, 'applying'),
    settle: (id, outcome) => {
      if (settled.has(id)) return;
      settled.add(id);
      const { setItemStatus } = useScribeRecommendationsStore.getState();
      if (outcome.status === 'applied') {
        // Carries the executor's note, e.g. a demoted primary or an auto-pick.
        setItemStatus(id, 'applied', outcome.note, { lowConfidence: outcome.lowConfidence });
        result.applied += 1;
      } else if (outcome.status === 'skipped') {
        setItemStatus(id, 'skipped', outcome.reason ?? 'Nothing was written.');
        result.skipped += 1;
      } else {
        setItemStatus(id, 'error', outcome.reason ?? errorMessage(undefined));
        result.failed += 1;
      }
    },
  };

  store.setIsApplying(true);
  try {
    await run(toApply, report, options.mode ?? 'bulk');
  } catch (error) {
    // The run itself failed: settle every waiting row rather than leave it spinning.
    console.error('Failed to apply scribe recommendations', error);
    for (const rec of toApply) report.settle(rec.id, { status: 'failed', reason: errorMessage(error) });
  } finally {
    // Rows the run never reported on are marked skipped.
    for (const rec of toApply) {
      if (!settled.has(rec.id))
        report.settle(rec.id, { status: 'skipped', reason: 'The run ended before this was applied.' });
    }
    await options.reconcile?.().catch(() => undefined);
    useScribeRecommendationsStore.getState().setIsApplying(false);
  }
  return result;
};
