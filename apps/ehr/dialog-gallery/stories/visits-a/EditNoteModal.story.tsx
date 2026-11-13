import { EditNoteModal } from 'src/features/visits/shared/components/generic-notes-list/components/EditNoteModal';
import { EditableNote, NoteLocales } from 'src/features/visits/shared/components/generic-notes-list/types';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { defineStory } from '../../harness/story';
import { ENCOUNTER_ID, PATIENT_ID } from './_fixtures';

export const note: EditableNote = {
  resourceId: 'note-1',
  text: 'Patient arrived with mother. Reports sore throat for 3 days, no fever this morning.',
  authorId: 'practitioner-1',
  authorName: 'Alex Morgan, RN',
  lastUpdated: '2026-11-13T15:04:00.000Z',
  encounterId: ENCOUNTER_ID,
  patientId: PATIENT_ID,
  type: NOTE_TYPE.INTAKE,
};

// Same strings the intake-notes list passes (useIntakeNotes.tsx keeps its config private).
export const locales: NoteLocales = {
  entityLabel: 'intake note',
  editModalTitle: 'Edit Intake Note',
  editModalPlaceholder: 'Intake Note',
  getAddButtonText: (isSaving) => (isSaving ? 'Saving Intake Note...' : 'Save Intake Note'),
  getMoreButtonText: (shown) => (shown ? 'See less' : 'See more'),
  getDeleteModalTitle: (entityLabel) => `Delete ${entityLabel}`,
  getDeleteModalContent: (entityLabel) => `Are you sure you want to permanently delete this ${entityLabel}?`,
  getKeepButtonText: () => 'Keep',
  getDeleteButtonText: (isDeleting) => (isDeleting ? 'Deleting...' : 'Delete'),
  getLeaveButtonText: () => 'Leave',
  getSaveButtonText: (isSaving) => (isSaving ? 'Saving...' : 'Save'),
  getErrorMessage: (action, entityLabel) => `Error during ${entityLabel} ${action}. Please try again.`,
  getGenericErrorMessage: () => 'An error occurred while saving the information. Please try again.',
};

export default defineStory({
  title: 'Edit note',
  source: 'apps/ehr/src/features/visits/shared/components/generic-notes-list/components/EditNoteModal.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Visit chart → any notes list (intake, internal, vitals, screening...) → edit icon on a note',
  render: () => (
    <EditNoteModal onClose={() => undefined} entity={note} onEdit={async () => undefined} locales={locales} />
  ),
  notes: "Title, field label and button texts come from the caller's locales; shown with the intake-note strings.",
});
