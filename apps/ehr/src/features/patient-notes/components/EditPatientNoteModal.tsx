import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import React, { useState } from 'react';
import { PatientNoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { useSavePatientNote } from '../hooks/useSavePatientNote';

interface EditPatientNoteModalProps {
  note: PatientNoteDTO;
  onClose: () => void;
}

export const EditPatientNoteModal: React.FC<EditPatientNoteModalProps> = ({ note, onClose }) => {
  const [text, setText] = useState(note.text);
  const { mutateAsync: save, isPending } = useSavePatientNote(note.patientId);

  const handleSave = async (): Promise<void> => {
    if (!text.trim()) return;
    await save({ ...note, text: text.trim() });
    onClose();
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Patient Note</DialogTitle>
      <DialogContent>
        <TextField
          multiline
          minRows={3}
          fullWidth
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isPending}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!text.trim() || isPending}
          startIcon={isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
