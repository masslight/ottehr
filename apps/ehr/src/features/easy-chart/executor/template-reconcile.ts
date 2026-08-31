// Merging a post-template reconciliation pass into the plan that is still running.
//
// THE PROBLEM THIS SOLVES. `apply-template` writes across many sections at once, and the plan that asked
// for it was written without knowing any of that: the model is shown template TITLES, never contents (see
// readTemplateTitles — it maps to `title` and nothing else). So after the template lands, two different
// things are wrong with the rest of that plan, and only one of them is a stale-data problem:
//
//   - steps that would now DUPLICATE what the template just charted. Fixable by re-reading the chart,
//     because the step exists and only its input was stale;
//   - steps that SHOULD exist and do not — the removal of a normal exam finding the provider
//     contradicted, the removal of a default diagnosis this visit does not support. No amount of
//     re-reading produces those, because nothing ever emitted them.
//
// The second is why there is a second planner call at all. This module is what makes its output safe to
// splice in, and every rule below exists because the alternative was observed to be worse.
//
// WHY NOT JUST USE THE SECOND PLAN. A reconciliation pass is a fresh model call over a narrative it has
// already seen once, and it does not reproduce the first pass faithfully — it drops steps it has no
// reason to repeat and re-summarises text it was not asked about. The first pass is the better source for
// everything it already got right; the second pass is consulted for exactly what the first could not
// know. So the merge is deliberately conservative: first-pass steps are kept unless the chart says they
// are already done, and second-pass steps are added, never substituted.

import { PlannedAction } from 'utils/lib/easy-chart/api';
import { ChartSnapshot } from './types';

/** Steps whose subject is an exam finding, in either direction. */
const isExamStep = (action: PlannedAction): boolean =>
  action.kind === 'add-exam-finding' || action.kind === 'remove-exam-finding';

/** A step's subject, loosely enough that the two passes' wording of the same finding collapses together. */
const subjectKey = (action: PlannedAction): string =>
  `${action.kind}|${(action.display ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 32)}`;

/**
 * Is this step already done, according to the chart as it stands after the template?
 *
 * ONLY the kinds that are NOT idempotent are listed, and that distinction is the whole point:
 *   - add-diagnosis / add-condition / add-cpt each write a NEW resource per call, so re-running one after
 *     the template charted the same code leaves two rows with the same code on the note;
 *   - set-em-code is singular — re-emitting replaces rather than duplicates, but a template that set a
 *     level did so from the visit type and the second pass has no better information, so it is left alone;
 *   - add-exam-finding writes a keyed boolean, so charting it twice is genuinely a no-op and is NOT
 *     filtered here. Filtering it would be actively wrong: the reconciliation pair removes a normal and
 *     adds the abnormal in the same slot, and dropping the add would leave the finding nowhere.
 */
export function isAlreadyCharted(action: PlannedAction, chart: ChartSnapshot): boolean {
  if ((action.kind === 'add-diagnosis' || action.kind === 'add-condition') && action.code) {
    return chart.diagnoses.some((dx) => dx.code?.toUpperCase() === action.code?.toUpperCase());
  }
  if (action.kind === 'add-cpt' && action.code) {
    return chart.cptCodes.some((cpt) => cpt.code?.toUpperCase() === action.code?.toUpperCase());
  }
  if (action.kind === 'set-em-code') return chart.hasEmCode;
  return false;
}

export interface TemplateReconcileInput {
  /** The steps of the original plan that had not run yet when the template was applied. */
  pending: PlannedAction[];
  /** What the reconciliation pass returned. */
  reconciliation: PlannedAction[];
  /** The chart as it stands AFTER the template, freshly read. */
  chart: ChartSnapshot;
}

/**
 * The remaining plan: the first pass's pending steps, plus what only the second pass could know.
 *
 * Four rules, in the order they are applied:
 *
 *  1. NO SECOND TEMPLATE. Belt and braces — the reconciliation call is not sent the practice's template
 *     list, so there should be no title for it to name, but a step that slipped through would either
 *     duplicate the applied template or overwrite the wrong fields with a different one.
 *
 *  2. THE FIRST PASS OWNS THE NOTE TEXT. `edit-note-text` from the second pass is dropped outright. The
 *     free-text fields were written from this same narrative one call ago, faithfully; a pass asked to
 *     reconcile structured items has no reason to improve them and empirically makes them worse — a
 *     detailed HPI comes back as "Patient presents with <dx>". The prompt also tells it not to emit these,
 *     so this is the guard for when it does anyway.
 *
 *  3. NOTHING ALREADY ON THE CHART. Applied to BOTH passes, because both are stale about the template in
 *     the same way: the first never saw it, and the second is a model that may re-emit what it was shown.
 *
 *  4. FIRST-PASS EXAM STEPS SURVIVE. A reconciliation pass that returns no exam steps has not decided the
 *     first pass was wrong — it was asked a narrower question. Dropping the first pass's exam work on its
 *     silence loses findings the provider actually dictated.
 *
 * Pure. Returns a new array and mutates nothing.
 */
export function mergeTemplateReconciliation(input: TemplateReconcileInput): PlannedAction[] {
  const { pending, reconciliation, chart } = input;

  const fromReconciliation = reconciliation
    .filter((action) => action.kind !== 'apply-template') // rule 1
    .filter((action) => action.kind !== 'edit-note-text') // rule 2
    .filter((action) => !isAlreadyCharted(action, chart)); // rule 3

  // Rule 4, plus rule 3 over the first pass. A first-pass step the reconciliation already covers is
  // dropped so the same thing is not charted twice by two passes that agreed.
  const covered = new Set(fromReconciliation.map(subjectKey));
  const fromFirstPass = pending
    .filter((action) => action.kind !== 'apply-template')
    .filter((action) => !isAlreadyCharted(action, chart))
    .filter((action) => !covered.has(subjectKey(action)));

  // Reconciliation FIRST: its removals clear the template's defaults out of the way before the first
  // pass's additions land in the same slots. Running the additions first would have the exam removal
  // resolve against a chart that has both the normal and the abnormal in it, and containment matching
  // could then take out the one just added.
  const removals = fromReconciliation.filter((action) => action.kind.startsWith('remove-'));
  const additions = fromReconciliation.filter((action) => !action.kind.startsWith('remove-'));
  return [...removals, ...additions, ...fromFirstPass];
}

/** Where the plan should pause to reconcile: the index of its `apply-template` step, or -1. */
export function templateStepIndex(actions: PlannedAction[]): number {
  return actions.findIndex((action) => action.kind === 'apply-template');
}

/** True when this step's writes cannot be modelled by advancing the snapshot, so the chart must be re-read. */
export function needsChartReread(action: PlannedAction): boolean {
  // Only apply-template today. It is the one kind whose response says how many resources it created but
  // not WHAT they are, so `advanceSnapshot` has nothing to record and every later step resolves against a
  // chart that is missing everything the template wrote.
  return action.kind === 'apply-template';
}

/** Exported for the tests that pin rule 4's subject matching. */
export const __testing = { isExamStep, subjectKey };
