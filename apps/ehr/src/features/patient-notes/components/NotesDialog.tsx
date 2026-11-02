import CloseIcon from '@mui/icons-material/Close';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import React from 'react';
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h4" component="div">
            {noteKind(target) === 'task' ? 'Internal Notes' : 'Patient Notes'}
          </Typography>
          <IconButton sx={{ color: 'grey.500' }} edge="end" color="inherit" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>
        <Box display="flex" alignItems="center">
          <VisibilityOffIcon color="primary" />
          <Typography variant="body2" color="textSecondary" sx={{ ml: 1 }}>
            Not visible to the patient
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ px: 0 }}>
        <AddNote target={target} onCreated={onNoteCreated} />
        <NotesList target={target} />
      </DialogContent>
    </Dialog>
  );
};
