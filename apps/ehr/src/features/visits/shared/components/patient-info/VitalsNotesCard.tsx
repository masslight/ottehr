import { dataTestIds } from 'src/constants/data-test-ids';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GenericNoteList } from '../generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from '../generic-notes-list/types';

const vitalsNotesConfig: GenericNotesConfig = {
  apiConfig: {
    type: NOTE_TYPE.VITALS,
  },
  locales: {
    entityLabel: 'vitals note',
    editModalTitle: 'Edit Vitals Note',
    editModalPlaceholder: 'Vitals Note',
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

const VitalsNotesCard: React.FC = () => (
  <GenericNoteList
    apiConfig={vitalsNotesConfig.apiConfig}
    locales={vitalsNotesConfig.locales}
    addNoteButtonDataTestId={dataTestIds.vitalsPage.addNoteButton}
  />
);

export default VitalsNotesCard;
