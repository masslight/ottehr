import { CSS_NOTE_ID, NOTE_TYPE, PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { GenericNotesConfig } from '../generic-notes-list/types';
import { GenericNoteList } from '../generic-notes-list/GenericNoteList';

const medicationNotesConfig: GenericNotesConfig = {
  apiConfig: {
    fieldName: 'notes',
    type: NOTE_TYPE.MEDICATION,
    searchParams: {
      _sort: '-_lastUpdated',
      _count: 1000,
      _tag: {
        type: 'token',
        value: `${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.MEDICATION}|${CSS_NOTE_ID}`,
      },
    },
  },
  locales: {
    entityLabel: 'medication note',
    editModalTitle: 'Edit Medication Note',
    editModalPlaceholder: 'Medication Note',
    getAddButtonText: (isSaving: boolean) => (isSaving ? 'Saving...' : 'Add'),
    getMoreButtonText: (isMoreEntitiesShown: boolean) => (isMoreEntitiesShown ? 'See less' : 'See more'),
    getDeleteModalTitle: (entityLabel: string) => `Delete ${entityLabel}`,
    getDeleteModalContent: (entityLabel: string) => `Are you sure you want to permanently delete this ${entityLabel}?`,
    getKeepButtonText: () => 'Keep',
    getDeleteButtonText: (isDeleting: boolean) => (isDeleting ? 'Deleting...' : 'Delete'),
    getLeaveButtonText: () => 'Leave',
    getSaveButtonText: (isSaving: boolean) => (isSaving ? 'Saving...' : 'Save'),
    getErrorMessage: (action: string, entityLabel: string) =>
      `Error during ${entityLabel} ${action}. Please try again.`,
    getGenericErrorMessage: () => 'An error occurred while saving the note. Please try again.',
  },
};

export const MedicationNotes: React.FC = () => (
  <GenericNoteList apiConfig={medicationNotesConfig.apiConfig} locales={medicationNotesConfig.locales} />
);
