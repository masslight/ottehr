import { StickyNote2Outlined as NoteIcon } from '@mui/icons-material';
import { Badge, IconButton, Tooltip } from '@mui/material';
import React, { useState } from 'react';
import { usePatientNotes } from '../hooks/usePatientNotes';
import { PatientNotesDrawer } from './PatientNotesDrawer';

interface PatientNotesButtonProps {
  patientId?: string;
}

export const PatientNotesButton: React.FC<PatientNotesButtonProps> = ({ patientId }) => {
  const [open, setOpen] = useState(false);
  const { data: notes } = usePatientNotes(patientId);
  const count = notes?.length ?? 0;

  if (!patientId) return null;

  return (
    <>
      <Tooltip title="Patient Notes">
        <IconButton onClick={() => setOpen(true)} aria-label="patient notes" size="small">
          <Badge badgeContent={count} color="primary" max={99}>
            <NoteIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <PatientNotesDrawer patientId={patientId} open={open} onClose={() => setOpen(false)} />
    </>
  );
};
