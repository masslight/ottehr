import { GenericNoteList } from 'src/features/visits/shared/components/generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from 'src/features/visits/shared/components/generic-notes-list/types';
import { IN_PERSON_NOTE_ID, NOTE_TYPE, PRIVATE_EXTENSION_BASE_URL } from 'utils';

const screeningNotesConfig: GenericNotesConfig = {
  apiConfig: {
    fieldName: 'notes',
    type: NOTE_TYPE.SCREENING,
    searchParams: {
      _sort: '-_lastUpdated',
      _count: 1000,
      _tag: `${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.SCREENING}|${IN_PERSON_NOTE_ID}`,
    },
  },
  locales: {
    entityLabel: 'screening note',
    editModalTitle: 'Edit Screening Note',
    editModalPlaceholder: 'Screening Note',
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
    getGenericErrorMessage: () => 'An error occurred while saving the information. Please try again.',
  },
};

export const ScreeningNotes: React.FC = () => (
  <GenericNoteList apiConfig={screeningNotesConfig.apiConfig} locales={screeningNotesConfig.locales} />
);
