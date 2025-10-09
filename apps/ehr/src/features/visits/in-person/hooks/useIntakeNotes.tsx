import CloseIcon from '@mui/icons-material/Close';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import React from 'react';
import { IN_PERSON_NOTE_ID, NOTE_TYPE, PRIVATE_EXTENSION_BASE_URL } from 'utils';
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <Box px={3} display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h4" component="div">
            Intake Notes
          </Typography>
          <IconButton sx={{ color: 'grey.500' }} edge="end" color="inherit" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ mt: -3 }}>
        <IntakeNotes />
      </DialogContent>
    </Dialog>
  );
};

const intakeNotesConfig: GenericNotesConfig = {
  apiConfig: {
    fieldName: 'notes',
    type: NOTE_TYPE.INTAKE,
    searchParams: {
      _search_by: 'encounter',
      _sort: '-_lastUpdated',
      _count: 1000,
      _tag: `${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.INTAKE}|${IN_PERSON_NOTE_ID}`,
    },
  },
  locales: {
    entityLabel: 'intake note',
    editModalTitle: 'Edit Intake Note',
    editModalPlaceholder: 'Intake Note',
    getAddButtonText: (isSaving: boolean) => (isSaving ? 'Saving Intake Note...' : 'Save Intake Note'),
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

export const IntakeNotes: React.FC = () => (
  <GenericNoteList
    separateEncounterNotes={false}
    apiConfig={intakeNotesConfig.apiConfig}
    locales={intakeNotesConfig.locales}
  />
);
