// The step machine: run a plan's actions in order and settle every step as applied, skipped with a
// reason, or failed with a reason.

import { ActionKind, ActionOfKind, RawAction } from 'utils/lib/easy-chart/actions';
import { PlannedAction } from 'utils/lib/easy-chart/api';
import { hasRequiredFields, isActionKind, missingRequiredFields } from 'utils/lib/easy-chart/registry';
import { AllChartValues } from 'utils/lib/types/api/chart-data/chart-data.types';
import { advanceSnapshot } from './chartSnapshot';
import { HANDLERS } from './handlers';
import { failed, HandlerContext, PlanStep, skipped, StepOutcome } from './types';

export interface RunPlanOptions {
  onStepStart?: (step: PlanStep) => void;
  onStepSettled?: (step: PlanStep) => void;
}

export interface PlanResult {
  steps: PlanStep[];
}

export async function runPlan(
  actions: PlannedAction[],
  context: HandlerContext,
  options: RunPlanOptions = {}
): Promise<PlanResult> {
  const steps: PlanStep[] = actions.map((action, index) => ({ index, action }));

  // Steps depend on each other (a second diagnosis must see the first one's primary), so each step reads
  // the snapshot as it stands after the previous applied steps, advanced by what those steps wrote.
  let liveChart = context.chart;

  for (const step of steps) {
    options.onStepStart?.(step);
    const saved: AllChartValues[] = [];
    const stepContext: HandlerContext = {
      ...context,
      chart: liveChart,
      writer: {
        save: (fields) => {
          saved.push(fields);
          return context.writer.save(fields);
        },
      },
    };
    step.outcome = await executeStep(step.action, stepContext);
    if (step.outcome.status === 'applied') {
      liveChart = advanceSnapshot(liveChart, step.action, step.outcome.createdResourceIds ?? [], saved);
    }
    options.onStepSettled?.(step);
  }

  return { steps };
}

async function executeStep(action: PlannedAction, context: HandlerContext): Promise<StepOutcome> {
  // A client older than the server can meet a kind it does not know.
  if (!isActionKind(action.kind)) {
    return skipped(
      `this version of Easy Chart does not know how to do "${action.kind}" — reload the page, or chart it in the regular chart`
    );
  }
  const kind: ActionKind = action.kind;

  if (!hasRequiredFields(kind, action as RawAction)) {
    const missing = missingRequiredFields(kind, action as RawAction);
    return skipped(`the assistant did not supply ${missing.join(' and ')}, so this could not be charted`);
  }

  // Safe because the server checked the action against its registry shape; the gate above re-checks presence.
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
