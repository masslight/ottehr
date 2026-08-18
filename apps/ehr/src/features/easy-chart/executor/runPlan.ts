// The step state machine: run a plan, settle every step, never no-op silently.
//
// For each action: check it is executable at all → dispatch → settle as applied / skipped(reason) /
// failed. There is no fourth outcome and no path that leaves a step unsettled, because a step that
// finishes without saying what happened reads to a provider as "there was nothing to chart".

import { ActionKind, ActionOfKind, RawAction } from 'utils/lib/easy-chart/actions';
import { PlannedAction } from 'utils/lib/easy-chart/api';
import { hasRequiredFields, missingRequiredFields } from 'utils/lib/easy-chart/registry';
import { HANDLERS, isHandledKind } from './handlers';
import { describeAction } from './labels';
import { failed, HandlerContext, PlanStep, skipped, StepOutcome } from './types';

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
}

export async function runPlan(
  actions: PlannedAction[],
  context: HandlerContext,
  options: RunPlanOptions = {}
): Promise<PlanResult> {
  const steps: PlanStep[] = actions.map((action, index) => ({
    index,
    action,
    label: describeAction(action),
  }));
  const createdBy = new Map<string, PlanStep>();

  for (const step of steps) {
    if (options.signal?.aborted) {
      step.outcome = skipped('the run was cancelled before this step');
      options.onStepSettled?.(step);
      continue;
    }

    options.onStepStart?.(step);
    step.outcome = await executeStep(step.action, context);
    for (const id of step.outcome.createdResourceIds ?? []) createdBy.set(id, step);
    options.onStepSettled?.(step);
  }

  return { steps, createdBy };
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
