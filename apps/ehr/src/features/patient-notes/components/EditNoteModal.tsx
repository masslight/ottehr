import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
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
    <AppDialog
      variant="form"
      size="s"
      open
      onClose={onClose}
      title={`Edit ${label}`}
      primary={{
        label: 'Save',
        onClick: handleSave,
        loading: isPending,
        disabled: !text.trim() || text.trim() === note.text,
      }}
    >
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
    </AppDialog>
  );
};
