import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { ScribeRecommendation } from './types';

const APPLY_ORDER: Record<ScribeRecommendation['kind'], number> = {
  // The template goes first so the granular items land on top of it (and its appended diagnoses
  // are visible to the duplicate check when the diagnoses are written).
  template: 0,
  hpi: 1,
  diagnosis: 2,
  allergy: 3,
  'vital-weight': 4,
  medication: 5,
  ros: 6,
};

export const sortForApply = (recommendations: ScribeRecommendation[]): ScribeRecommendation[] =>
  [...recommendations].sort((a, b) => {
    const byKind = APPLY_ORDER[a.kind] - APPLY_ORDER[b.kind];
    if (byKind !== 0) return byKind;
    // Among diagnoses the preferred primary goes first so it is the one that ends up primary.
    if (a.kind === 'diagnosis' && b.kind === 'diagnosis') {
      return Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary));
    }
    return 0;
  });

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : 'Something went wrong. Please try again.';

export interface ApplyRunResult {
  applied: number;
  failed: number;
}

/** Ids of the observations the provider still has checked in the "add these observations" stage. */
export const pendingObservationIds = (): string[] => {
  const { recommendations, itemState } = useScribeRecommendationsStore.getState();
  return recommendations
    .filter((rec) => {
      // The template is its own stage with its own button, so it never rides along with a batch.
      if (rec.section === 'template') return false;
      const item = itemState[rec.id];
      return item?.selected && item.status !== 'applied';
    })
    .map((rec) => rec.id);
};

/**
 * Applies the named recommendations one at a time, recording each outcome on its row. Sequential
 * on purpose: the per-row status then reads as a checklist filling in, and later items see what
 * earlier ones wrote (a primary diagnosis, a template's diagnoses). `reconcile` runs once at the
 * end regardless of failures.
 */
export const applyRecommendations = async (
  ids: string[],
  applyOne: (recommendation: ScribeRecommendation) => Promise<void>,
  options: { reconcile?: () => Promise<void> } = {}
): Promise<ApplyRunResult> => {
  const store = useScribeRecommendationsStore.getState();
  const wanted = new Set(ids);
  const toApply = sortForApply(
    store.recommendations.filter((rec) => wanted.has(rec.id) && store.itemState[rec.id]?.status !== 'applied')
  );
  const result: ApplyRunResult = { applied: 0, failed: 0 };
  if (toApply.length === 0) return result;

  store.setIsApplying(true);
  try {
    for (const rec of toApply) {
      // Read the latest copy: the provider may have edited a row while earlier ones were saving.
      const latest = useScribeRecommendationsStore.getState().recommendations.find((r) => r.id === rec.id) ?? rec;
      store.setItemStatus(rec.id, 'applying');
      try {
        await applyOne(latest);
        store.setItemStatus(rec.id, 'applied');
        result.applied += 1;
      } catch (error) {
        console.error('Failed to apply scribe recommendation', rec.id, error);
        store.setItemStatus(rec.id, 'error', errorMessage(error));
        result.failed += 1;
      }
    }
  } finally {
    await options.reconcile?.().catch(() => undefined);
    useScribeRecommendationsStore.getState().setIsApplying(false);
  }
  return result;
};
