// THE CC↔HPI STORAGE SWAP, isolated in one place.
//
// The in-person Chief Complaint textarea is backed by the `historyOfPresentIllness` chart key, and
// the History of Present Illness textarea is backed by `chiefComplaint`. This is a data-model wart,
// not a bug to fix here: the progress note, Review & Sign and the sign blockers all read it this way
// already, and changing the storage would need a migration.
//
// It is isolated in this module because the alternative is reasoning about it in five places. Every
// consumer — client and server, reader and writer — goes through these functions. Verified against
// ProgressNoteDetails, which reads the displayed chief complaint from
// `chartFields.historyOfPresentIllness.text` and the displayed HPI from `chartFields.chiefComplaint.text`.

import { NoteTextField } from './actions';

/** Chart-data keys the free-text note fields are stored under. */
export type NoteChartKey = 'chiefComplaint' | 'historyOfPresentIllness' | 'mechanismOfInjury' | 'ros' | 'medicalDecision';

const CLINICAL_FIELD_TO_CHART_KEY: Record<NoteTextField, NoteChartKey> = {
  // Swapped on purpose — see the module comment.
  chiefComplaint: 'historyOfPresentIllness',
  historyOfPresentIllness: 'chiefComplaint',
  mechanismOfInjury: 'mechanismOfInjury',
  ros: 'ros',
  medicalDecision: 'medicalDecision',
};

/**
 * The chart-data key that stores what a clinician calls `field`.
 *
 * `field` is the CLINICAL name — what the provider, the prompt and the note pane call it. The return
 * value is the STORAGE name, which for chief complaint and HPI is the other one.
 */
export function chartKeyForNoteField(field: NoteTextField): NoteChartKey {
  return CLINICAL_FIELD_TO_CHART_KEY[field];
}

const CHART_KEY_TO_CLINICAL_FIELD = Object.fromEntries(
  Object.entries(CLINICAL_FIELD_TO_CHART_KEY).map(([clinical, storage]) => [storage, clinical])
) as Record<NoteChartKey, NoteTextField>;

/** The inverse: what a clinician calls the text stored under `key`. */
export function noteFieldForChartKey(key: NoteChartKey): NoteTextField {
  return CHART_KEY_TO_CLINICAL_FIELD[key];
}

/** Human label for a clinical note field, for step cards and picker prompts. */
export const NOTE_FIELD_LABELS: Record<NoteTextField, string> = {
  chiefComplaint: 'Chief Complaint',
  historyOfPresentIllness: 'History of Present Illness',
  mechanismOfInjury: 'Mechanism of Injury',
  ros: 'Review of Systems',
  medicalDecision: 'Medical Decision Making',
};
