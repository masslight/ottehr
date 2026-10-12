import { Box, CircularProgress, TextField } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { useCreatePatientNote } from '../hooks/useCreatePatientNote';
import { noteKind, NoteTarget } from '../hooks/usePatientNotes';

interface AddPatientNoteProps {
  target: NoteTarget;
  onCreated?: (text: string) => void;
}

export const AddPatientNote: React.FC<AddPatientNoteProps> = ({ target, onCreated }) => {
  const [text, setText] = useState('');
  const { mutateAsync: save, isPending } = useCreatePatientNote();

  const handleSave = async (): Promise<void> => {
    if (!text.trim()) return;
    try {
      await save({ ...target, text: text.trim() });
      setText('');
      onCreated?.(text.trim());
    } catch {
      enqueueSnackbar('Failed to add note. Please try again.', { variant: 'error' });
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: 3 }}>
      <Box sx={{ flex: 1 }}>
        <TextField
          variant="outlined"
          fullWidth
          autoComplete="off"
          multiline
          label={`Enter ${noteKind(target)} note...`}
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
        {isPending ? 'Saving...' : `Save ${noteKind(target) === 'task' ? 'Task' : 'Patient'} Note`}
      </RoundedButton>
    </Box>
  );
};
