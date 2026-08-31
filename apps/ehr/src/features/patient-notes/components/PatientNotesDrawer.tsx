import { Close as CloseIcon } from '@mui/icons-material';
import { Box, Divider, Drawer, IconButton, Typography } from '@mui/material';
import React from 'react';
import { AddPatientNote } from './AddPatientNote';
import { PatientNotesList } from './PatientNotesList';

interface PatientNotesDrawerProps {
  patientId: string;
  open: boolean;
  onClose: () => void;
}

export const PatientNotesDrawer: React.FC<PatientNotesDrawerProps> = ({ patientId, open, onClose }) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 480, display: 'flex', flexDirection: 'column' } }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          flexShrink: 0,
        }}
      >
        <Typography variant="h6">Patient Notes</Typography>
        <IconButton onClick={onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      <Box sx={{ px: 2, py: 2, flexShrink: 0 }}>
        <AddPatientNote patientId={patientId} />
      </Box>

      <Divider />

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }}>
        <PatientNotesList patientId={patientId} />
      </Box>
    </Drawer>
  );
};
