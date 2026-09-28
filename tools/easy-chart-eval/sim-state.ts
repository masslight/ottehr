// Fold executed plan steps into the SimFinalState the scorer compares against gold. The executor's own
// outcome decides what landed: a skipped step is recorded with its reason, and only applied steps become
// state.

import { buildExamCommentFields } from 'utils/lib/config-helpers/exam-leaves';
import { NOTE_TEXT_FIELDS } from 'utils/lib/easy-chart/actions';
import { PlannedAction } from 'utils/lib/easy-chart/api';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { PlanStep } from '../../apps/ehr/src/features/easy-chart/executor/types';
import { emptySimState, SimFinalState, SimSource } from './score-harvested';

/** The exam cards' free-text fields, so a comment write is never scored as a ticked checkbox. */
const EXAM_COMMENT_FIELDS = new Set(Object.values(buildExamCommentFields(DefaultExamComponentsConfig)));

const NOTE_FIELDS: readonly string[] = NOTE_TEXT_FIELDS;

export function foldStepsIntoState(steps: PlanStep[], source: SimSource, into?: SimFinalState): SimFinalState {
  const state = into ?? emptySimState();

  for (const step of steps) {
    const action = step.action as PlannedAction & Record<string, unknown>;
    const display = typeof action.display === 'string' ? action.display.trim() : '';
    const outcome = step.outcome;

    // "Never planned" and "planned but not resolved" are different failures, so the reason is kept.
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
      case 'add-allergy':
        state.allergies.push({ display, source });
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
        state.surgicalHistory.push({ display, source });
        break;
      case 'add-hospitalization':
        state.hospitalizations.push({ display, source });
        break;
      case 'set-em-code':
        state.emEvents.push({ type: 'set', code: asCode(action.code), display, source });
        break;
      case 'add-exam-finding': {
        // The resolved catalogue field; a comment write is not a ticked checkbox and is kept apart.
        const field = resolvedId(step);
        if (EXAM_COMMENT_FIELDS.has(field)) {
          state.examComments.push({ section: field, text: display, source });
          break;
        }
        state.examObservations.push({ field, label: display, source });
        break;
      }
      case 'add-ros-finding':
        state.rosObservations.push({
          baseKey: resolvedId(step),
          field: resolvedId(step),
          label: display,
          finding: action.finding === 'denies' ? 'denies' : 'reports',
          source,
        });
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
      case 'apply-template':
        // Only a suggestion, so nothing is charted; the scorer counts suggested titles.
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

/** The chart field the executor resolved the action to, or a slug of its wording when it resolved none. */
function resolvedId(step: PlanStep): string {
  const matched = step.outcome?.matchedId;
  if (matched) return matched;
  const display = (step.action as { display?: string }).display ?? '';
  return display
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Marks the row removed rather than deleting it: the scorer tells "never charted" from "removed". */
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

function findByDisplay<T extends { display: string }>(items: T[], needle: string): T | undefined {
  const lower = needle.toLowerCase();
  return (
    items.find((item) => item.display.toLowerCase() === lower) ??
    items.find((item) => item.display.toLowerCase().includes(lower) || lower.includes(item.display.toLowerCase()))
  );
}
