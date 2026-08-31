import { NoteLocales } from './types';

export const defaultNoteLocales: NoteLocales = {
  entityLabel: 'note',
  editModalTitle: 'Edit Note',
  editModalPlaceholder: 'Note',
  getAddButtonText: (isSaving: boolean) => (isSaving ? 'Saving...' : 'Add'),
  getMoreButtonText: (isMoreEntitiesShown: boolean) => (isMoreEntitiesShown ? 'See less' : 'See more'),
  getDeleteModalTitle: (entityLabel: string) => `Delete ${entityLabel}`,
  getDeleteModalContent: (entityLabel: string) => `Are you sure you want to permanently delete this ${entityLabel}?`,
  getKeepButtonText: () => 'Keep',
  getDeleteButtonText: (isDeleting: boolean) => (isDeleting ? 'Deleting...' : 'Delete'),
  getLeaveButtonText: () => 'Leave',
  getSaveButtonText: (isSaving: boolean) => (isSaving ? 'Saving...' : 'Save'),
  getErrorMessage: (action: string, entityLabel: string) => `Error during ${entityLabel} ${action}. Please try again.`,
  getGenericErrorMessage: () => 'An error occurred while saving the information. Please try again.',
};
