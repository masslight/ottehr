import CloseIcon from '@mui/icons-material/Close';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import React from 'react';
import { PaperStyled } from 'src/features/visits/shared/components/generic-notes-list/components/ui/PaperStyled';
import { AddPatientNote } from './AddPatientNote';
import { PatientNotesList } from './PatientNotesList';

interface PatientNotesDialogProps {
  patientId: string;
  open: boolean;
  onClose: () => void;
}

export const PatientNotesDialog: React.FC<PatientNotesDialogProps> = ({ patientId, open, onClose }) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <Box px={3} display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h4" component="div">
            Patient Notes
          </Typography>
          <IconButton sx={{ color: 'grey.500' }} edge="end" color="inherit" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ mt: -3 }}>
        <PaperStyled>
          <AddPatientNote patientId={patientId} />
          <PatientNotesList patientId={patientId} />
        </PaperStyled>
      </DialogContent>
    </Dialog>
  );
};
