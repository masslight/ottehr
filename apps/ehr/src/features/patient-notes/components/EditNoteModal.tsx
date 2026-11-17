import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useTheme,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { TextFieldStyled } from 'src/features/visits/shared/components/generic-notes-list/components/ui/TextFieldStyled';
import { NoteDTO, UpdateNoteRequest } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { noteKind, NoteTarget } from '../hooks/useNotes';
import { useUpdateNote } from '../hooks/useUpdateNote';

interface EditNoteModalProps {
  note: NoteDTO;
  target: NoteTarget;
  onClose: () => void;
}

export const EditNoteModal: React.FC<EditNoteModalProps> = ({ note, target, onClose }) => {
  const theme = useTheme();
  const [text, setText] = useState(note.text);
  const { mutateAsync: save, isPending } = useUpdateNote(target);
  const label = noteKind(target) === 'task' ? 'Task Note' : 'Patient Note';

  const handleSave = async (): Promise<void> => {
    if (!text.trim() || !note.resourceId) return;
    const payload: UpdateNoteRequest = {
      resourceId: note.resourceId,
      ...target,
      text: text.trim(),
    };
    try {
      await save(payload);
      onClose();
    } catch {
      enqueueSnackbar('Failed to save note. Please try again.', { variant: 'error' });
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" color={theme.palette.primary.dark}>
          <Typography variant="h4">Edit {label}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TextFieldStyled
          autoFocus
          margin="dense"
          id="patient-note-text"
          label={label}
          type="text"
          fullWidth
          multiline
          rows={6}
          variant="outlined"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isPending}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1, pb: 3 }}>
        <RoundedButton onClick={onClose} variant="text" sx={{ mr: 1 }} disabled={isPending}>
          Leave
        </RoundedButton>
        <RoundedButton
          disabled={!text.trim() || text.trim() === note.text || isPending}
          onClick={handleSave}
          variant="contained"
          startIcon={isPending ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {isPending ? 'Saving...' : 'Save'}
        </RoundedButton>
      </DialogActions>
    </Dialog>
  );
};
