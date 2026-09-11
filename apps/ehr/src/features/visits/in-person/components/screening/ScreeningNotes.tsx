import { dataTestIds } from 'src/constants/data-test-ids';
import { GenericNoteList } from 'src/features/visits/shared/components/generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from 'src/features/visits/shared/components/generic-notes-list/types';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';

const screeningNotesConfig: GenericNotesConfig = {
  apiConfig: {
    type: NOTE_TYPE.SCREENING,
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
  <GenericNoteList
    apiConfig={screeningNotesConfig.apiConfig}
    locales={screeningNotesConfig.locales}
    addNoteButtonDataTestId={dataTestIds.screeningPage.addNoteButton}
  />
);
