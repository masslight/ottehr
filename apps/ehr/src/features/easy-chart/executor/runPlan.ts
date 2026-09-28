// The step machine: run a plan's actions in order and settle every step as applied, skipped with a
// reason, or failed with a reason.

import { ActionKind, ActionOfKind, RawAction } from 'utils/lib/easy-chart/actions';
import { PlannedAction } from 'utils/lib/easy-chart/api';
import { hasRequiredFields, missingRequiredFields } from 'utils/lib/easy-chart/registry';
import { advanceSnapshot } from './chartSnapshot';
import { HANDLERS, isHandledKind } from './handlers';
import { describeAction } from './labels';
import { ChartSnapshot, failed, HandlerContext, PlanStep, skipped, StepOutcome } from './types';

export interface RunPlanOptions {
  onStepStart?: (step: PlanStep) => void;
  onStepSettled?: (step: PlanStep) => void;
}

export interface PlanResult {
  steps: PlanStep[];
  /** The starting snapshot advanced by every applied step. */
  chart: ChartSnapshot;
}

/**
 * When a plan removes the primary diagnosis and adds another without claiming primary, the first add
 * takes it over; otherwise a diagnosis swap would leave the note with no primary. Never overrides an add
 * that claims primary itself. Pure.
 */
function reclaimPrimaryOnSwap(actions: PlannedAction[], chart: ChartSnapshot): PlannedAction[] {
  const removes = actions.filter((a) => a.kind === 'remove-diagnosis');
  const addIndex = actions.findIndex((a) => a.kind === 'add-diagnosis');
  if (removes.length === 0 || addIndex < 0) return actions;
  if (actions.some((a) => a.kind === 'add-diagnosis' && a.isPrimary === true)) return actions;

  // The same containment rule the remove handler resolves with.
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
  const steps: PlanStep[] = reclaimPrimaryOnSwap(actions, context.chart).map((action, index) => ({
    index,
    action,
    label: describeAction(action),
  }));

  // Steps depend on each other (a swap's removal frees the primary for the add), so handlers read the
  // snapshot as it stands after the previous applied steps.
  let liveChart = context.chart;
  const liveContext: HandlerContext = {
    ...context,
    get chart() {
      return liveChart;
    },
  };

  for (const step of steps) {
    options.onStepStart?.(step);
    step.outcome = await executeStep(step.action, liveContext);
    if (step.outcome.status === 'applied') {
      liveChart = advanceSnapshot(liveChart, step.action, step.outcome.createdResourceIds ?? []);
    }
    options.onStepSettled?.(step);
  }

  return { steps, chart: liveChart };
}

async function executeStep(action: PlannedAction, context: HandlerContext): Promise<StepOutcome> {
  // A client older than the server can meet a kind it does not know.
  if (!isHandledKind(action.kind)) {
    return skipped(
      `this version of Easy Chart does not know how to do "${action.kind}" — reload the page, or chart it in the regular chart`
    );
  }
  const kind: ActionKind = action.kind;

  if (!hasRequiredFields(kind, action as RawAction)) {
    const missing = missingRequiredFields(kind, action as RawAction);
    return skipped(`the assistant did not supply ${missing.join(' and ')}, so this could not be charted`);
  }

  // The required-field gate above is what makes this narrowing safe.
  const handler = HANDLERS[kind] as (a: ActionOfKind<typeof kind>, c: HandlerContext) => Promise<StepOutcome>;
  try {
    const outcome = await handler(action as unknown as ActionOfKind<typeof kind>, context);
    if (!outcome?.status) return failed('the step finished without reporting an outcome');
    if (outcome.status !== 'applied' && !outcome.reason?.trim()) {
      return { ...outcome, reason: 'the step did not complete, and no reason was given' };
    }
    return outcome;
  } catch (error) {
    console.error(`[easy-chart] step "${action.kind}" failed`, error);
    const message = error instanceof Error ? error.message : String(error);
    return failed(`this step failed: ${message}`);
  }
}
