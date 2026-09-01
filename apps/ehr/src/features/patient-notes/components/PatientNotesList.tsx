import { Box, Button, CircularProgress, Typography } from '@mui/material';
import React, { useState } from 'react';
import { usePatientNotes } from '../hooks/usePatientNotes';
import { PatientNoteItem } from './PatientNoteItem';

const PAGE_SIZE = 20;

interface PatientNotesListProps {
  patientId: string;
}

export const PatientNotesList: React.FC<PatientNotesListProps> = ({ patientId }) => {
  const { data: notes, isLoading, isError } = usePatientNotes(patientId);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Typography color="error" variant="body2" sx={{ px: 3, py: 2 }}>
        Failed to load notes.
      </Typography>
    );
  }

  if (!notes?.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, py: 2 }}>
        No patient notes yet.
      </Typography>
    );
  }

  const visible = notes.slice(0, visibleCount);
  const hasMore = notes.length > visibleCount;

  return (
    <>
      {visible.map((note, i) => (
        <PatientNoteItem key={note.resourceId ?? i} note={note} />
      ))}
      {hasMore && (
        <Box sx={{ px: 3, py: 1 }}>
          <Button size="small" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            Load more ({notes.length - visibleCount} remaining)
          </Button>
        </Box>
      )}
    </>
  );
};
