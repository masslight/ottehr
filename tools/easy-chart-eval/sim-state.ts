// Fold a plan's ACTIONS into the SimFinalState the scorer compares against gold.
//
// The scorer takes a plain data structure, not a live chart, which is what makes it portable — see
// HARVESTED.md. This module is the only new piece of the harvested-corpus loop: everything upstream of
// it is the real endpoint and the real executor, and everything downstream is the ported scorer.
//
// WHY NOT REPLAY THROUGH THE CLIENT. The previous harness rebuilt this state by running the actions
// through the client's matchers, which meant the eval could only ever be as correct as a second copy of
// the dispatch logic. Here the executor's own outcome decides what landed: an action that the executor
// SKIPPED is recorded as skipped with its reason, and only applied actions become state. So a matcher
// change shows up in the score instead of being invisible to it.

import { PlannedAction } from 'utils/lib/easy-chart/api';
import { PlanStep } from '../../apps/ehr/src/features/easy-chart/executor/types';
import { emptySimState, SimFinalState, SimSource } from './score-harvested';

/** Note fields the model can edit, keyed as the action's `field` enum spells them. */
const NOTE_FIELDS = ['chiefComplaint', 'historyOfPresentIllness', 'mechanismOfInjury', 'ros', 'medicalDecision'];

export function foldStepsIntoState(steps: PlanStep[], source: SimSource, into?: SimFinalState): SimFinalState {
  const state = into ?? emptySimState();

  for (const step of steps) {
    const action = step.action as PlannedAction & Record<string, unknown>;
    const display = typeof action.display === 'string' ? action.display.trim() : '';
    const outcome = step.outcome;

    // A step that did not apply changed nothing. Recording the reason keeps a skipped order visible in
    // the results file: "the planner never ordered it" and "the executor could not resolve it" are
    // different failures and must not look the same in a score.
    if (!outcome || outcome.status !== 'applied') {
      state.skipped.push({ kind: action.kind, display: display || undefined, reason: outcome?.reason ?? 'no outcome' });
      continue;
    }

    switch (action.kind) {
      case 'add-diagnosis':
        state.diagnoses.push({
          display,
          code: typeof action.code === 'string' ? action.code : undefined,
          isPrimary: action.isPrimary === true,
          source,
        });
        break;
      case 'remove-diagnosis':
        markRemoved(state.diagnoses, display, source);
        break;
      case 'add-condition':
        state.conditions.push({ display, code: asCode(action.code), source });
        break;
      case 'remove-condition':
        markRemoved(state.conditions, display, source);
        break;
      case 'add-allergy':
        state.allergies.push({ display, source });
        break;
      case 'remove-allergy':
        markRemoved(state.allergies, display, source);
        break;
      case 'add-medication':
        state.medications.push({
          display,
          strength: typeof action.strength === 'string' ? action.strength : undefined,
          source,
        });
        break;
      case 'remove-medication':
        markRemoved(state.medications, display, source);
        break;
      case 'add-surgical-history':
        state.surgicalHistory.push({ display, code: asCode(action.code), source });
        break;
      case 'remove-surgical-history':
        markRemoved(state.surgicalHistory, display, source);
        break;
      case 'add-hospitalization':
        state.hospitalizations.push({ display, code: asCode(action.code), source });
        break;
      case 'remove-hospitalization':
        markRemoved(state.hospitalizations, display, source);
        break;
      case 'set-em-code':
        state.emEvents.push({ type: 'set', code: asCode(action.code), display, source });
        break;
      case 'remove-em-code':
        state.emEvents.push({ type: 'remove', code: asCode(action.code), source });
        break;
      case 'add-cpt':
        state.cptCodes.push({ display, code: asCode(action.code), source });
        break;
      case 'remove-cpt':
        markRemoved(state.cptCodes, display || (asCode(action.code) ?? ''), source);
        break;
      case 'add-exam-finding':
        // The RESOLVED catalogue field, not the dictated phrase. The scorer compares against gold's own
        // field keys, so a slug of "no wheezing" could never match `ros-respiratory-wheezing` — that is
        // what made exam and ROS score a flat zero even once the actions were charting correctly.
        state.examObservations.push({ field: resolvedId(step), label: display, source });
        break;
      case 'remove-exam-finding':
        markRemovedBy(state.examObservations, display, source);
        break;
      case 'add-ros-finding':
        state.rosObservations.push({
          baseKey: resolvedId(step),
          field: resolvedId(step),
          label: display,
          finding: action.finding === 'denies' ? 'denies' : 'reports',
          source,
        });
        break;
      case 'remove-ros-finding':
        markRemovedBy(state.rosObservations, display, source);
        break;
      case 'edit-note-text': {
        const field = typeof action.field === 'string' ? action.field : '';
        const text = typeof action.newText === 'string' ? action.newText : '';
        if (NOTE_FIELDS.includes(field)) {
          state.noteText[field as keyof SimFinalState['noteText']] = { text, source };
        }
        break;
      }
      case 'set-vital':
        state.vitals.push({ field: typeof action.field === 'string' ? action.field : '', display });
        break;
      case 'set-disposition':
        state.disposition = {
          type: typeof action.dispositionType === 'string' ? action.dispositionType : undefined,
          text: typeof action.text === 'string' ? action.text : undefined,
        };
        break;
      case 'add-patient-instruction':
        state.instructions.push(typeof action.text === 'string' ? action.text : display);
        break;
      case 'add-in-house-lab':
        state.labsOrdered.push({ kind: 'in-house', display });
        break;
      case 'add-external-lab':
        state.labsOrdered.push({ kind: 'external', display });
        break;
      case 'add-radiology':
        state.radiology.push(display);
        break;
      case 'add-procedure':
        state.procedures.push(display);
        break;
      case 'add-nursing-order':
        state.nursingOrders.push(typeof action.text === 'string' ? action.text : display);
        break;
      case 'apply-template':
        state.templatesApplied.push(display);
        break;
      case 'provider-note':
      case 'reply':
        state.providerNotes.push(typeof action.text === 'string' ? action.text : display);
        break;
      default:
        state.otherSteps.push({ kind: action.kind });
        break;
    }
  }

  return state;
}

const asCode = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined);

/**
 * What the executor actually resolved this action to. `matchedId` is set by the catalogue path, so this
 * is the chart's OWN field key rather than a guess derived from the provider's wording — the scorer
 * compares against gold's field keys, and a slug of "no wheezing" could never match
 * `ros-respiratory-wheezing`. That mismatch is what made exam and ROS score a flat zero even after the
 * actions were charting correctly. The slug fallback covers an action charted without a catalogue
 * lookup: it will not match gold, but a missing row would understate what the plan did, which is worse.
 */
function resolvedId(step: PlanStep): string {
  const matched = step.outcome?.matchedId;
  if (matched) return matched;
  const display = (step.action as { display?: string }).display ?? '';
  return display
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Mark the matching row removed rather than deleting it: the scorer distinguishes "never charted" from
 * "charted then removed", and by WHICH phase. */
function markRemoved(
  items: { display: string; removed?: boolean; removedBy?: SimSource }[],
  needle: string,
  by: SimSource
): void {
  const hit = findByDisplay(items, needle);
  if (hit) {
    hit.removed = true;
    hit.removedBy = by;
  }
}

function markRemovedBy(
  items: { label: string; removed?: boolean; removedBy?: SimSource }[],
  needle: string,
  by: SimSource
): void {
  const lower = needle.toLowerCase();
  const hit =
    items.find((item) => item.label.toLowerCase() === lower) ??
    items.find((item) => item.label.toLowerCase().includes(lower) || lower.includes(item.label.toLowerCase()));
  if (hit) {
    hit.removed = true;
    hit.removedBy = by;
  }
}

function findByDisplay<T extends { display: string }>(items: T[], needle: string): T | undefined {
  const lower = needle.toLowerCase();
  return (
    items.find((item) => item.display.toLowerCase() === lower) ??
    items.find((item) => item.display.toLowerCase().includes(lower) || lower.includes(item.display.toLowerCase()))
  );
}
