import { Box } from '@mui/material';
import React from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GenericNoteList } from '../../shared/components/generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from '../../shared/components/generic-notes-list/types';

export const useIntakeNotesModal = (): {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  IntakeNotesModal: React.FC<IntakeNotesModalProps>;
} => {
  const [isOpen, setIsOpen] = React.useState(false);

  const openModal = (): void => setIsOpen(true);
  const closeModal = (): void => setIsOpen(false);

  return {
    isOpen,
    openModal,
    closeModal,
    IntakeNotesModal,
  };
};

interface IntakeNotesModalProps {
  open: boolean;
  onClose: () => void;
}

const IntakeNotesModal: React.FC<IntakeNotesModalProps> = ({ open, onClose }) => {
  return (
    <AppDialog variant="form" size="m" open={open} onClose={onClose} title="Intake Notes">
      {/* The notes list brings its own top margin. */}
      <Box sx={{ mt: -3 }}>
        <IntakeNotes />
      </Box>
    </AppDialog>
  );
};

const intakeNotesConfig: GenericNotesConfig = {
  apiConfig: {
    type: NOTE_TYPE.INTAKE,
  },
  locales: {
    entityLabel: 'intake note',
    editModalTitle: 'Edit Intake Note',
    editModalPlaceholder: 'Intake Note',
    getAddButtonText: (isSaving: boolean) => (isSaving ? 'Saving Intake Note...' : 'Save Intake Note'),
    getMoreButtonText: (isMoreEntitiesShown: boolean) => (isMoreEntitiesShown ? 'See less' : 'See more'),
    getDeleteModalTitle: (entityLabel: string) => `Delete ${entityLabel}`,
    getDeleteModalContent: (entityLabel: string) => `Are you sure you want to permanently delete this ${entityLabel}?`,
    getKeepButtonText: () => 'Cancel',
    getDeleteButtonText: (isDeleting: boolean) => (isDeleting ? 'Deleting...' : 'Delete Note'),
    getLeaveButtonText: () => 'Cancel',
    getSaveButtonText: (isSaving: boolean) => (isSaving ? 'Saving...' : 'Save'),
    getErrorMessage: (action: string, entityLabel: string) =>
      `Error during ${entityLabel} ${action}. Please try again.`,
    getGenericErrorMessage: () => 'An error occurred while saving the information. Please try again.',
  },
};

export const IntakeNotes: React.FC = () => (
  <GenericNoteList
    separateEncounterNotes={false}
    apiConfig={intakeNotesConfig.apiConfig}
    locales={intakeNotesConfig.locales}
  />
);
