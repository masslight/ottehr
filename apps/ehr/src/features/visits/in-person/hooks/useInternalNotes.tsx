import CloseIcon from '@mui/icons-material/Close';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import React from 'react';
import { IN_PERSON_NOTE_ID, NOTE_TYPE, PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { GenericNoteList } from '../../shared/components/generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from '../../shared/components/generic-notes-list/types';

export const useInternalNotesModal = (): {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  InternalNotesModal: React.FC<InternalNotesModalProps>;
} => {
  const [isOpen, setIsOpen] = React.useState(false);

  const openModal = (): void => setIsOpen(true);
  const closeModal = (): void => setIsOpen(false);

  return {
    isOpen,
    openModal,
    closeModal,
    InternalNotesModal,
  };
};

interface InternalNotesModalProps {
  open: boolean;
  onClose: () => void;
}

const InternalNotesModal: React.FC<InternalNotesModalProps> = ({ open, onClose }) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <Box px={3} display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h4" component="div">
            Internal Notes
          </Typography>
          <IconButton sx={{ color: 'grey.500' }} edge="end" color="inherit" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>
        <Box px={3} display="flex" alignItems="center">
          <VisibilityOffIcon color="primary" />
          <Typography variant="body2" color="textSecondary" sx={{ ml: 1 }}>
            Not visible to the patient
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ mt: -3 }}>
        <InternalNotes />
      </DialogContent>
    </Dialog>
  );
};

const internalNotesConfig: GenericNotesConfig = {
  apiConfig: {
    fieldName: 'notes',
    type: NOTE_TYPE.INTERNAL,
    searchParams: {
      _search_by: 'encounter',
      _sort: '-_lastUpdated',
      _count: 1000,
      _tag: `${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.INTERNAL}|${IN_PERSON_NOTE_ID}`,
    },
  },
  locales: {
    entityLabel: 'internal note',
    editModalTitle: 'Edit Internal Note',
    editModalPlaceholder: 'Internal Note',
    getAddButtonText: (isSaving: boolean) => (isSaving ? 'Saving Internal Note...' : 'Save Internal Note'),
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

export const InternalNotes: React.FC = () => (
  <GenericNoteList
    separateEncounterNotes={false}
    apiConfig={internalNotesConfig.apiConfig}
    locales={internalNotesConfig.locales}
  />
);
