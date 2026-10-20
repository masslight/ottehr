import { Box, Button, CircularProgress, Typography } from '@mui/material';
import React from 'react';
import { usePatientNotes } from '../hooks/usePatientNotes';
import { PatientNoteItem } from './PatientNoteItem';

interface PatientNotesListProps {
  patientId: string;
}

export const PatientNotesList: React.FC<PatientNotesListProps> = ({ patientId }) => {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = usePatientNotes(patientId);

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

  const notes = data?.pages.flatMap((page) => page.notes) ?? [];

  if (!notes.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, py: 2 }}>
        No patient notes yet.
      </Typography>
    );
  }

  return (
    <>
      {notes.map((note, i) => (
        <PatientNoteItem key={note.resourceId ?? i} note={note} />
      ))}
      {hasNextPage && (
        <Box sx={{ px: 3, py: 1 }}>
          <Button
            size="small"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            startIcon={isFetchingNextPage ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </Button>
        </Box>
      )}
    </>
  );
};
