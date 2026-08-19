// The step state machine: run a plan, settle every step, never no-op silently.
//
// For each action: check it is executable at all → dispatch → settle as applied / skipped(reason) /
// failed. There is no fourth outcome and no path that leaves a step unsettled, because a step that
// finishes without saying what happened reads to a provider as "there was nothing to chart".

import { ActionKind, ActionOfKind, RawAction } from 'utils/lib/easy-chart/actions';
import { PlannedAction } from 'utils/lib/easy-chart/api';
import { hasRequiredFields, missingRequiredFields } from 'utils/lib/easy-chart/registry';
import { advanceSnapshot } from './chartSnapshot';
import { HANDLERS, isHandledKind } from './handlers';
import { describeAction } from './labels';
import { ChartSnapshot, failed, HandlerContext, PlanStep, skipped, StepOutcome } from './types';

export interface RunPlanOptions {
  /** Called as each step starts, so the UI can keep the current step in view. */
  onStepStart?: (step: PlanStep) => void;
  /** Called as each step settles, so completed steps tick off live rather than all at the end. */
  onStepSettled?: (step: PlanStep) => void;
  /** Stop early — the provider navigated away or cancelled. Remaining steps settle as skipped. */
  signal?: AbortSignal;
}

export interface PlanResult {
  steps: PlanStep[];
  /** resourceId → the step that created it, for the provenance layer. */
  createdBy: Map<string, PlanStep>;
  /**
   * The chart as it stands after the run — the initial snapshot advanced by every applied step. A caller
   * that runs a SECOND plan against the same chart needs it: the review pass reasons about the note the
   * first pass produced, and starting it from the pre-plan snapshot would hide everything just charted.
   */
  chart: ChartSnapshot;
}

/**
 * Let the replacement diagnosis reclaim primary when the plan REMOVES the primary one.
 *
 * A diagnosis correction is a PAIR — remove-diagnosis + add-diagnosis — and that is what the review
 * pass emits whenever it replaces a wrong diagnosis. The add carries isPrimary:false (or omits it),
 * which is right for a pure addition: an addition must never usurp a primary the provider already set.
 * It is wrong here, because the primary is on its way out. Left alone the note ends up with no primary
 * at all, which is billing-invalid — and a missing primary is much worse than a debatable one.
 *
 * Deliberately narrow. It fires only when ALL of these hold, so it can never mint a second primary or
 * override a deliberate choice:
 *   - the plan removes a diagnosis that IS primary on the chart right now;
 *   - the plan adds at least one diagnosis;
 *   - no add in the plan claims primary for itself.
 * Then the FIRST add becomes primary, even over an explicit false. Pure: returns a new array.
 */
export function reclaimPrimaryOnSwap(actions: PlannedAction[], chart: ChartSnapshot): PlannedAction[] {
  const removes = actions.filter((a) => a.kind === 'remove-diagnosis');
  const addIndex = actions.findIndex((a) => a.kind === 'add-diagnosis');
  if (removes.length === 0 || addIndex < 0) return actions;
  if (actions.some((a) => a.kind === 'add-diagnosis' && a.isPrimary === true)) return actions;

  // Resolve the removal against the chart with the same containment rule the remove handler uses, so
  // this agrees with the row that will actually be removed.
  const removesPrimary = removes.some((remove) => {
    const needle = (remove.display ?? '').toLowerCase().trim();
    if (!needle) return false;
    const hit =
      chart.diagnoses.find((dx) => dx.display.toLowerCase() === needle) ??
      chart.diagnoses.find(
        (dx) => dx.display.toLowerCase().includes(needle) || needle.includes(dx.display.toLowerCase())
      );
    return hit?.isPrimary === true;
  });
  if (!removesPrimary) return actions;

  return actions.map((action, index) => (index === addIndex ? { ...action, isPrimary: true } : action));
}

export async function runPlan(
  actions: PlannedAction[],
  context: HandlerContext,
  options: RunPlanOptions = {}
): Promise<PlanResult> {
  // Plan-level pre-pass: decided before anything executes, because it depends on what the plan as a
  // whole does, not on what any one step can see.
  const planned = reclaimPrimaryOnSwap(actions, context.chart);
  const steps: PlanStep[] = planned.map((action, index) => ({
    index,
    action,
    label: describeAction(action),
  }));
  const createdBy = new Map<string, PlanStep>();

  // THE SNAPSHOT ADVANCES AS THE PLAN RUNS. Steps in one plan depend on each other — the assessment
  // is charted before the plan that references it — so a snapshot frozen before the run makes later
  // steps reason about a chart that no longer exists. See advanceSnapshot for the three defects that
  // came from freezing it. Handlers read `context.chart` unchanged; the getter is what makes it current.
  let liveChart = context.chart;
  const liveContext: HandlerContext = {
    ...context,
    get chart() {
      return liveChart;
    },
  };

  for (const step of steps) {
    if (options.signal?.aborted) {
      step.outcome = skipped('the run was cancelled before this step');
      options.onStepSettled?.(step);
      continue;
    }

    options.onStepStart?.(step);
    step.outcome = await executeStep(step.action, liveContext);
    // Only an applied step changed the chart; a skipped or failed one must not move the snapshot.
    if (step.outcome.status === 'applied') {
      liveChart = advanceSnapshot(liveChart, step.action, step.outcome.createdResourceIds ?? []);
    }
    for (const id of step.outcome.createdResourceIds ?? []) createdBy.set(id, step);
    options.onStepSettled?.(step);
  }

  return { steps, createdBy, chart: liveChart };
}

async function executeStep(action: PlannedAction, context: HandlerContext): Promise<StepOutcome> {
  // THE RUNTIME TWIN of the compile-time exhaustive table. An old client against a newer endpoint
  // will meet a kind this build has never heard of; say so plainly rather than falling through to a
  // generic "no match", which a provider reads as "there was nothing to chart".
  if (!isHandledKind(action.kind)) {
    return skipped(
      `this version of Easy Chart does not know how to do "${action.kind}" — reload the page, or chart it in the regular chart`
    );
  }
  const kind: ActionKind = action.kind;

  // The single runtime gate between a raw model action and a typed one.
  if (!hasRequiredFields(kind, action as RawAction)) {
    const missing = missingRequiredFields(kind, action as RawAction);
    return skipped(`the assistant did not supply ${missing.join(' and ')}, so this could not be charted`);
  }

  const handler = HANDLERS[kind] as (a: ActionOfKind<typeof kind>, c: HandlerContext) => Promise<StepOutcome>;
  try {
    const outcome = await handler(action as unknown as ActionOfKind<typeof kind>, context);
    // A handler that returns something unusable is a bug in the handler, not a silent success.
    if (!outcome || !outcome.status) return failed('the step finished without reporting an outcome');
    if (outcome.status !== 'applied' && !outcome.reason?.trim()) {
      return { ...outcome, reason: 'the step did not complete, and no reason was given' };
    }
    return outcome;
  } catch (error) {
    // The provider sees this text, so it must be readable. The stack goes to the console.
    console.error(`[easy-chart] step "${action.kind}" failed`, error);
    const message = error instanceof Error ? error.message : String(error);
    return failed(`this step failed: ${message}`);
  }
}

/** Convenience for the UI: how the run went overall. */
export function summarisePlan(steps: PlanStep[]): { applied: number; skipped: number; failed: number } {
  return {
    applied: steps.filter((s) => s.outcome?.status === 'applied').length,
    skipped: steps.filter((s) => s.outcome?.status === 'skipped').length,
    failed: steps.filter((s) => s.outcome?.status === 'failed').length,
  };
}
