// The label a provider reads for an action, derived from the action rather than written by the model.

import { ActionKind, NoteTextField, PlannableVitalField } from 'utils/lib/easy-chart/actions';
import { PlannedAction } from 'utils/lib/easy-chart/api';
import { NOTE_FIELD_LABELS } from 'utils/lib/easy-chart/note-fields';
import { mapDispositionTypeToLabel } from 'utils/lib/fhir/disposition';
import { DispositionType } from 'utils/lib/types/api/chart-data/chart-data.types';

/** The card's own name for a disposition type ("Primary Care Physician"), or the type when it has none. */
const dispositionLabel = (type: string): string => mapDispositionTypeToLabel[type as DispositionType] ?? type;

const VITAL_LABELS: Record<PlannableVitalField, string> = {
  'vital-temperature': 'temperature',
  'vital-heartbeat': 'heart rate',
  'vital-respiration-rate': 'respiration rate',
  'vital-oxygen-sat': 'oxygen saturation',
  'vital-blood-pressure': 'blood pressure',
  'vital-weight': 'weight',
  'vital-height': 'height',
};

/** An addition names only what it is ("Exam finding: Sinus tenderness"); other verbs say what they do. */
const VERBS: Partial<Record<ActionKind, string>> = {
  'apply-template': 'Suggesting template',
  'add-allergy': 'Allergy',
  'add-condition': 'Past medical history',
  'add-medication': 'Medication',
  'add-surgical-history': 'Surgical history',
  'add-hospitalization': 'Hospitalization',
  'add-exam-finding': 'Exam finding',
  'add-ros-finding': 'Review of systems',
  'add-diagnosis': 'Diagnosis',
  'add-patient-instruction': 'Patient instruction',
};

export function describeAction(action: PlannedAction): string {
  switch (action.kind) {
    case 'edit-note-text':
      return `Writing ${NOTE_FIELD_LABELS[action.field as NoteTextField] ?? action.field}`;
    case 'set-vital':
      return `Recording ${VITAL_LABELS[action.field as PlannableVitalField] ?? 'vital'}${
        action.display ? `: ${action.display}` : ''
      }`;
    case 'set-em-code':
      return `Setting E&M level${action.code ? `: ${action.code}` : ''}`;
    case 'set-disposition':
      return `Setting disposition${action.dispositionType ? `: ${dispositionLabel(action.dispositionType)}` : ''}`;
    case 'provider-note':
      return 'Note for you';
    case 'reply':
      return 'Answering';
    case 'unknown':
      return 'Unclassified request';
    default: {
      const verb = VERBS[action.kind] ?? action.kind;
      const subject = action.display ?? action.code ?? action.text;
      return subject ? `${verb}: ${subject}` : verb;
    }
  }
}
