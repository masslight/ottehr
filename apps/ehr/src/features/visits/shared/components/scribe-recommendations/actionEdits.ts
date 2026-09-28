// Editing a generic action row: the wording the executor will resolve or write (a vital reading, an
// instruction, a finding to look up). A kind whose meaning is a code offers nothing to edit.

import { describeAction } from 'src/features/easy-chart/executor/labels';
import { PlannableVitalField } from 'utils/lib/easy-chart/actions';
import { PlannedAction } from 'utils/lib/easy-chart/api';
import { parseVitalDisplay } from 'utils/lib/easy-chart/vitals';
import { actionSecondary } from './analysis';
import { ActionRecommendation } from './types';

interface EditableActionText {
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
      return action.display ? { field: 'display', value: action.display, label: 'Exam finding' } : undefined;
    case 'add-ros-finding':
      return action.display ? { field: 'display', value: action.display, label: 'Finding' } : undefined;
    case 'add-surgical-history':
      return action.display ? { field: 'display', value: action.display, label: 'Surgery' } : undefined;
    case 'add-hospitalization':
      return action.display ? { field: 'display', value: action.display, label: 'Hospitalization' } : undefined;
    case 'remove-diagnosis':
    case 'remove-medication':
      return action.display ? { field: 'display', value: action.display, label: 'Item to remove' } : undefined;
    default:
      // Coded kinds (E&M level, conditions): the code is the meaning, the words only its label.
      return undefined;
  }
}

/**
 * The action with its wording replaced, or undefined when the new wording cannot be used (a vital reading
 * that does not parse). New wording drops the model's search synonyms; the transcript quote stays.
 */
export function withEditedText(action: PlannedAction, value: string): PlannedAction | undefined {
  const editable = editableActionText(action);
  const next = value.trim();
  if (!editable || !next || next === editable.value) return undefined;

  const edited: PlannedAction = { ...action, [editable.field]: next };
  if (editable.field === 'display') delete edited.searchTerms;

  if (action.kind === 'set-vital') {
    // Held to the same parser the server's guard ran on the model's reading.
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
