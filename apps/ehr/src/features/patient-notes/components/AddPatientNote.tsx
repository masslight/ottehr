import { Box, Button, CircularProgress, TextField } from '@mui/material';
import React, { useState } from 'react';
import { PatientNoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { useSavePatientNote } from '../hooks/useSavePatientNote';

interface AddPatientNoteProps {
  patientId: string;
}

export const AddPatientNote: React.FC<AddPatientNoteProps> = ({ patientId }) => {
  const [text, setText] = useState('');
  const user = useEvolveUser();
  const { mutateAsync: save, isPending } = useSavePatientNote(patientId);

  const handleSave = async (): Promise<void> => {
    if (!text.trim() || !user) return;

    const note: PatientNoteDTO = {
      patientId,
      text: text.trim(),
      authorId: user.profile?.split('/')?.[1] ?? 'unknown',
      authorName: user.userName,
    };

    await save(note);
    setText('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <TextField
        multiline
        minRows={2}
        fullWidth
        placeholder="Add a patient note..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isPending}
        size="small"
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="small"
          disabled={!text.trim() || isPending || !user}
          onClick={handleSave}
          startIcon={isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {isPending ? 'Saving...' : 'Save Note'}
        </Button>
      </Box>
    </Box>
  );
};
