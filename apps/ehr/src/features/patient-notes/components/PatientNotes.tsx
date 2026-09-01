import { StickyNote2Outlined as NoteIcon } from '@mui/icons-material';
import { Badge, IconButton, Tooltip } from '@mui/material';
import React, { useState } from 'react';
import { usePatientNotes } from '../hooks/usePatientNotes';
import { PatientNotesDialog } from './PatientNotesDialog';

interface PatientNotesProps {
  patientId?: string;
}

export const PatientNotes: React.FC<PatientNotesProps> = ({ patientId }) => {
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

      <PatientNotesDialog patientId={patientId} open={open} onClose={() => setOpen(false)} />
    </>
  );
};
