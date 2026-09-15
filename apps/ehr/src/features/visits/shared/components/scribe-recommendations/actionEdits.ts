// Editing a generic action row: which of its words the provider may change, and what the change does.
//
// The panel has editors of its own for the kinds it understands (a diagnosis picks a code, a weight is a
// number in pounds, a finding flips R/D). Everything else is shown as the executor's step label, and what
// the provider can correct there is the WORDING the executor will resolve or write: the exam finding to look
// up, the instruction text, the reading of a vital. A kind whose meaning is a code — an E&M level, a coded
// history item — has no text worth editing on its own, so it offers none.

import { describeAction } from 'src/features/easy-chart/executor/labels';
import { PlannableVitalField } from 'utils/lib/easy-chart/actions';
import { PlannedAction } from 'utils/lib/easy-chart/api';
import { parseVitalDisplay } from 'utils/lib/easy-chart/vitals';
import { actionSecondary } from './analysis';
import { ActionRecommendation } from './types';

export interface EditableActionText {
  /** The action property the words live in. */
  field: 'display' | 'text';
  value: string;
  /** What the field is called in the editor. */
  label: string;
}

/** The text a generic row lets the provider edit, or undefined when the kind's meaning is not its wording. */
export function editableActionText(action: PlannedAction): EditableActionText | undefined {
  switch (action.kind) {
    case 'set-vital':
      return action.display ? { field: 'display', value: action.display, label: 'Reading' } : undefined;
    case 'add-patient-instruction':
      return action.text ? { field: 'text', value: action.text, label: 'Instruction' } : undefined;
    case 'set-disposition':
      return action.text ? { field: 'text', value: action.text, label: 'Disposition note' } : undefined;
    case 'add-exam-finding':
    case 'remove-exam-finding':
      return action.display ? { field: 'display', value: action.display, label: 'Exam finding' } : undefined;
    case 'add-ros-finding':
    case 'remove-ros-finding':
      return action.display ? { field: 'display', value: action.display, label: 'Finding' } : undefined;
    case 'add-surgical-history':
    case 'remove-surgical-history':
      return action.display ? { field: 'display', value: action.display, label: 'Surgery' } : undefined;
    case 'add-hospitalization':
    case 'remove-hospitalization':
      return action.display ? { field: 'display', value: action.display, label: 'Hospitalization' } : undefined;
    case 'remove-diagnosis':
    case 'remove-medication':
    case 'remove-allergy':
      return action.display ? { field: 'display', value: action.display, label: 'Item to remove' } : undefined;
    // Coded: the code is the meaning, and the words are only its label.
    case 'set-em-code':
    case 'add-condition':
    case 'add-cpt':
    default:
      return undefined;
  }
}

/**
 * The row's action with its wording replaced, or undefined when the new wording cannot be used — a vital
 * reading that does not parse keeps the old one rather than reaching the chart half-read.
 *
 * A re-worded search term no longer matches the synonyms the model attached to the old one, so they go.
 * The transcript quote stays: the words behind the item have not changed, only the provider's reading of them.
 */
export function withEditedText(action: PlannedAction, value: string): PlannedAction | undefined {
  const editable = editableActionText(action);
  const next = value.trim();
  if (!editable || !next || next === editable.value) return undefined;

  const edited: PlannedAction = { ...action, [editable.field]: next };
  if (editable.field === 'display') delete edited.searchTerms;

  if (action.kind === 'set-vital') {
    // The same parser the server's guard ran on the model's reading, so an edited reading is held to the
    // same rules: a unit it knows, a plausible number, a pair for blood pressure.
    const parsed = parseVitalDisplay(action.field as PlannableVitalField, next);
    if (parsed.status === 'ok') {
      return {
        ...edited,
        value: parsed.value,
        unit: parsed.unit,
        systolic: undefined,
        diastolic: undefined,
        caution: parsed.caution,
      };
    }
    if (parsed.status === 'ok-bp') {
      return { ...edited, systolic: parsed.systolic, diastolic: parsed.diastolic, value: undefined, unit: undefined };
    }
    return undefined;
  }
  return edited;
}

/** The patch that puts an edited action on its row: the action, and the label and detail read off it. */
export function actionEditPatch(action: PlannedAction): Pick<ActionRecommendation, 'action' | 'label' | 'secondary'> {
  return { action, label: describeAction(action), secondary: actionSecondary(action) };
}
