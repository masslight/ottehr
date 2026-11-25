import { Box } from '@mui/material';
import React from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { noteKind, NoteTarget } from '../hooks/useNotes';
import { AddNote } from './AddNote';
import { NotesList } from './NotesList';

interface NotesDialogProps {
  target: NoteTarget;
  open: boolean;
  onClose: () => void;
  onNoteCreated?: (text: string) => void;
}

export const NotesDialog: React.FC<NotesDialogProps> = ({ target, open, onClose, onNoteCreated }) => {
  return (
    <AppDialog
      variant="form"
      size="m"
      open={open}
      onClose={onClose}
      title={noteKind(target) === 'task' ? 'Internal Notes' : 'Patient Notes'}
      subtitle="Not visible to the patient"
      // The note rows highlight edge to edge and bring their own side padding.
      disableContentPadding
    >
      <Box sx={{ pb: '20px' }}>
        <AddNote target={target} onCreated={onNoteCreated} />
        <NotesList target={target} />
      </Box>
    </AppDialog>
  );
};
