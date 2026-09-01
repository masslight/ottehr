import { Box, CircularProgress, TextField } from '@mui/material';
import React, { useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
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
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: 3 }}>
      <Box sx={{ flex: 1 }}>
        <TextField
          variant="outlined"
          fullWidth
          autoComplete="off"
          multiline
          label="Enter patient note..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isPending}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!text.trim() || !user) return;
              void handleSave();
            }
          }}
          sx={{
            pr: 2,
            '& .MuiInputLabel-root': { color: 'text.secondary' },
          }}
        />
      </Box>
      <RoundedButton
        variant="contained"
        color="primary"
        disabled={!text.trim() || isPending || !user}
        onClick={handleSave}
        sx={{ height: '56px', minWidth: '80px', px: 2 }}
        startIcon={isPending ? <CircularProgress size={20} color="inherit" /> : null}
      >
        {isPending ? 'Saving...' : 'Save Note'}
      </RoundedButton>
    </Box>
  );
};
