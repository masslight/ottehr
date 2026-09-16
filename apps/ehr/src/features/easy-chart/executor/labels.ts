// Step labels — what the provider reads on the plan card while a step runs and after it settles.
//
// Derived from the action, not written by the model: a label the model supplies is one more thing
// that can disagree with what was actually charted.

import { ActionKind, NoteTextField } from 'utils/lib/easy-chart/actions';
import { PlannedAction } from 'utils/lib/easy-chart/api';
import { NOTE_FIELD_LABELS } from 'utils/lib/easy-chart/note-fields';

const VITAL_LABELS: Record<string, string> = {
  'vital-temperature': 'temperature',
  'vital-heartbeat': 'heart rate',
  'vital-respiration-rate': 'respiration rate',
  'vital-oxygen-sat': 'oxygen saturation',
  'vital-blood-pressure': 'blood pressure',
  'vital-weight': 'weight',
  'vital-height': 'height',
};

// An addition names what it is and nothing more: "Exam finding: Sinus tenderness". The "Adding" said
// nothing the panel had not already said — every suggestion in a list of suggestions is something being
// added — and it pushed the thing itself, which is what the provider is checking, a word further right.
// Verbs that carry meaning stay: a removal, an order and a template are each doing something other than
// adding an entry, and the row has to say which.
const VERBS: Partial<Record<ActionKind, string>> = {
  'apply-template': 'Suggesting template',
  'add-allergy': 'Allergy',
  'remove-allergy': 'Removing allergy',
  'add-condition': 'Past medical history',
  'remove-condition': 'Removing past medical history',
  'add-medication': 'Medication',
  'remove-medication': 'Removing medication',
  'add-surgical-history': 'Surgical history',
  'remove-surgical-history': 'Removing surgical history',
  'add-hospitalization': 'Hospitalization',
  'remove-hospitalization': 'Removing hospitalization',
  'add-exam-finding': 'Exam finding',
  'remove-exam-finding': 'Removing exam finding',
  'add-ros-finding': 'Review of systems',
  'remove-ros-finding': 'Removing review of systems',
  'add-diagnosis': 'Diagnosis',
  'remove-diagnosis': 'Removing diagnosis',
  'add-in-house-lab': 'Ordering in-house lab',
  'add-external-lab': 'Ordering lab',
  'add-radiology': 'Ordering imaging',
  'add-procedure': 'Procedure',
  'update-procedure': 'Updating procedure',
  'add-cpt': 'CPT code',
  'remove-cpt': 'Removing CPT code',
  'add-nursing-order': 'Nursing order',
  'add-patient-instruction': 'Patient instruction',
};

export function describeAction(action: PlannedAction): string {
  switch (action.kind) {
    case 'edit-note-text':
      return `Writing ${NOTE_FIELD_LABELS[action.field as NoteTextField] ?? action.field}`;
    case 'set-vital':
      return `Recording ${VITAL_LABELS[action.field ?? ''] ?? 'vital'}${action.display ? `: ${action.display}` : ''}`;
    case 'set-em-code':
      return `Setting E&M level${action.code ? `: ${action.code}` : ''}`;
    case 'remove-em-code':
      return 'Removing E&M level';
    case 'set-disposition':
      return `Setting disposition${action.dispositionType ? `: ${action.dispositionType}` : ''}`;
    case 'provider-note':
      return 'Note for you';
    case 'reply':
      return 'Answering';
    case 'unknown':
      return 'Unclassified request';
    default: {
      const verb = VERBS[action.kind as ActionKind] ?? action.kind;
      const subject = action.display ?? action.code ?? action.text;
      return subject ? `${verb}: ${subject}` : verb;
    }
  }
}
