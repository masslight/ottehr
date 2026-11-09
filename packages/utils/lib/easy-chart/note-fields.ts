// The CC↔HPI storage swap, isolated in one place: the in-person Chief Complaint box is stored under the
// `historyOfPresentIllness` chart key and the HPI box under `chiefComplaint` (see ProgressNoteDetails).
// Everything else in Easy Chart uses clinical names and converts through `chartKeyForNoteField`.

import { NoteTextField } from './actions';

/** Chart-data keys the free-text note fields are stored under. */
export type NoteChartKey =
  | 'chiefComplaint'
  | 'historyOfPresentIllness'
  | 'mechanismOfInjury'
  | 'ros'
  | 'medicalDecision';

const CLINICAL_FIELD_TO_CHART_KEY: Record<NoteTextField, NoteChartKey> = {
  chiefComplaint: 'historyOfPresentIllness',
  historyOfPresentIllness: 'chiefComplaint',
  mechanismOfInjury: 'mechanismOfInjury',
  ros: 'ros',
  medicalDecision: 'medicalDecision',
};

/** The chart-data key that stores what a clinician calls `field`. */
export function chartKeyForNoteField(field: NoteTextField): NoteChartKey {
  return CLINICAL_FIELD_TO_CHART_KEY[field];
}

export const NOTE_FIELD_LABELS: Record<NoteTextField, string> = {
  chiefComplaint: 'Chief Complaint',
  historyOfPresentIllness: 'History of Present Illness',
  mechanismOfInjury: 'Mechanism of Injury',
  ros: 'Review of Systems',
  medicalDecision: 'Medical Decision Making',
};
