import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { EditableNote, NoteLocales } from '../types';
import { TextFieldStyled } from './ui/TextFieldStyled';

export const EditNoteModal: React.FC<{
  onClose: () => void;
  entity: EditableNote;
  onEdit: (entity: EditableNote, newText: string) => Promise<void>;
  locales: NoteLocales;
}> = ({ onClose, entity, onEdit, locales }) => {
  const [editedText, setEditedText] = useState(entity.text);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setEditedText(e.target.value);
  };

  const handleSave = async (): Promise<void> => {
    if (!editedText) return;
    setIsSaving(true);
    try {
      await onEdit(entity, editedText);
      onClose();
    } catch {
      enqueueSnackbar(locales.getGenericErrorMessage(), { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppDialog
      variant="form"
      size="s"
      open
      onClose={onClose}
      title={locales.editModalTitle}
      titleTestId={dataTestIds.editNoteDialog.title}
      dismiss={{ label: locales.getLeaveButtonText(), 'data-testid': dataTestIds.editNoteDialog.cancelButton }}
      primary={{
        label: locales.getSaveButtonText(false),
        onClick: handleSave,
        loading: isSaving,
        disabled: !editedText,
        'data-testid': dataTestIds.editNoteDialog.proceedButton,
      }}
    >
      <TextFieldStyled
        data-testid={dataTestIds.editNoteDialog.message}
        autoFocus
        margin="dense"
        id="entity-text"
        label={locales.editModalPlaceholder}
        type="text"
        fullWidth
        multiline
        rows={6}
        variant="outlined"
        value={editedText}
        onChange={handleChange}
      />
    </AppDialog>
  );
};
