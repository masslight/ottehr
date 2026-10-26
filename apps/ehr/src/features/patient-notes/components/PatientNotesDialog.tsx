import CloseIcon from '@mui/icons-material/Close';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import React from 'react';
import { noteKind, NoteTarget } from '../hooks/usePatientNotes';
import { AddPatientNote } from './AddPatientNote';
import { PatientNotesList } from './PatientNotesList';

interface PatientNotesDialogProps {
  target: NoteTarget;
  open: boolean;
  onClose: () => void;
  onNoteCreated?: (text: string) => void;
}

export const PatientNotesDialog: React.FC<PatientNotesDialogProps> = ({ target, open, onClose, onNoteCreated }) => {
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
      {/* The add-note row and note rows bring their own side padding. */}
      <DialogContent sx={{ px: 0 }}>
        <AddPatientNote target={target} onCreated={onNoteCreated} />
        <PatientNotesList target={target} />
      </DialogContent>
    </Dialog>
  );
};
