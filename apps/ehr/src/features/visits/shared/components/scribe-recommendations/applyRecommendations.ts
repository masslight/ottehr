import { ExecutionMode, StepOutcome } from 'src/features/easy-chart/executor/types';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { ScribeRecommendation } from './types';

const APPLY_ORDER: Record<Exclude<ScribeRecommendation['kind'], 'action'>, number> = {
  // The template goes first so the granular items land on top of it (and its appended diagnoses
  // are visible to the duplicate check when the diagnoses are written).
  template: 0,
  hpi: 2,
  diagnosis: 3,
  allergy: 4,
  'vital-weight': 5,
  medication: 6,
  ros: 7,
};

/**
 * Removals right after the template, before anything is added: a diagnosis swap is a remove and an add,
 * and the add can only take over as primary once the old primary is gone. Every other generic action goes
 * last, after the rows the panel has editors for.
 */
const applyOrder = (rec: ScribeRecommendation): number => {
  if (rec.kind === 'action') return rec.action.kind.startsWith('remove-') ? 1 : 8;
  return APPLY_ORDER[rec.kind];
};

export const sortForApply = (recommendations: ScribeRecommendation[]): ScribeRecommendation[] =>
  [...recommendations].sort((a, b) => {
    const byKind = applyOrder(a) - applyOrder(b);
    if (byKind !== 0) return byKind;
    // Among diagnoses the preferred primary goes first so it is the one that ends up primary.
    if (a.kind === 'diagnosis' && b.kind === 'diagnosis') {
      return Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary));
    }
    return 0;
  });

// Zambda calls reject with a plain APIError object rather than an Error instance, so an
// `instanceof Error` check throws the server's own wording away — which is how a medication the
// FHIR API rejected only ever showed up as "something went wrong".
export const errorMessage = (error: unknown): string =>
  getApiError({ error, defaultError: 'Something went wrong. Please try again.' });

export interface ApplyRunResult {
  applied: number;
  skipped: number;
  failed: number;
}

/** How a run tells the panel about each row: when it starts, and how it ended. One verdict per row. */
export interface RunReport {
  start(id: string): void;
  settle(id: string, outcome: StepOutcome): void;
}

/**
 * Writes a batch of recommendations to the chart. The hook supplies one: the template through the
 * apply-template endpoint, everything else through the Easy Chart executor. Sorted already; `mode` says
 * whether ambiguity may ask the provider (one row on its own) or should auto-pick (a whole batch).
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
      // Anything the chart already holds is nothing to write.
      if (charted.has(rec.id)) return false;
      const item = itemState[rec.id];
      return item?.selected && item.status !== 'applied';
    })
    .map((rec) => rec.id);
};

/**
 * Applies the named recommendations, recording each outcome on its row as the run reports it. The run is
 * one executor pass over the batch — sequential inside, so the per-row status reads as a checklist filling
 * in and later items see what earlier ones wrote (a primary diagnosis, a template's diagnoses). `reconcile`
 * runs once at the end regardless of failures.
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
        // The executor's own note travels with the tick: a demoted primary or an auto-pick is news too.
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
    // The run itself broke, not one step: every row still waiting is told so rather than left spinning.
    console.error('Failed to apply scribe recommendations', error);
    for (const rec of toApply) report.settle(rec.id, { status: 'failed', reason: errorMessage(error) });
  } finally {
    // A row the run never reported on is a row nothing happened to, and the provider is told that too.
    for (const rec of toApply) {
      if (!settled.has(rec.id))
        report.settle(rec.id, { status: 'skipped', reason: 'The run ended before this was applied.' });
    }
    await options.reconcile?.().catch(() => undefined);
    useScribeRecommendationsStore.getState().setIsApplying(false);
  }
  return result;
};
