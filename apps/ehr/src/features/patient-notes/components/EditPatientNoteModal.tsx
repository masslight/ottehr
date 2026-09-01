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
import React, { useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { TextFieldStyled } from 'src/features/visits/shared/components/generic-notes-list/components/ui/TextFieldStyled';
import { PatientNoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { useSavePatientNote } from '../hooks/useSavePatientNote';

interface EditPatientNoteModalProps {
  note: PatientNoteDTO;
  onClose: () => void;
}

export const EditPatientNoteModal: React.FC<EditPatientNoteModalProps> = ({ note, onClose }) => {
  const theme = useTheme();
  const [text, setText] = useState(note.text);
  const { mutateAsync: save, isPending } = useSavePatientNote(note.patientId);

  const handleSave = async (): Promise<void> => {
    if (!text.trim()) return;
    await save({ ...note, text: text.trim() });
    onClose();
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" color={theme.palette.primary.dark}>
          <Typography variant="h4">Edit Patient Note</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TextFieldStyled
          autoFocus
          margin="dense"
          id="patient-note-text"
          label="Patient Note"
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
          disabled={!text.trim() || isPending}
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
