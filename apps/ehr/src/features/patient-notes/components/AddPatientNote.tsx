import { Box, CircularProgress, TextField } from '@mui/material';
import React, { useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { useSavePatientNote } from '../hooks/useSavePatientNote';

interface AddPatientNoteProps {
  patientId: string;
}

export const AddPatientNote: React.FC<AddPatientNoteProps> = ({ patientId }) => {
  const [text, setText] = useState('');
  const { mutateAsync: save, isPending } = useSavePatientNote(patientId);

  const handleSave = async (): Promise<void> => {
    if (!text.trim()) return;
    await save({ patientId, text: text.trim() });
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
              if (!text.trim()) return;
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
        disabled={!text.trim() || isPending}
        onClick={handleSave}
        sx={{ height: '56px', minWidth: '80px', px: 2 }}
        startIcon={isPending ? <CircularProgress size={20} color="inherit" /> : null}
      >
        {isPending ? 'Saving...' : 'Save Patient Note'}
      </RoundedButton>
    </Box>
  );
};
