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
import { RoundedButton } from '../../../../../components/RoundedButton';
import { EditableNote, NoteLocales } from '../types';
import { TextFieldStyled } from './ui/TextFieldStyled';

export const EditNoteModal: React.FC<{
  open: boolean;
  onClose: () => void;
  entity: EditableNote;
  onEdit: (entity: EditableNote, newText: string) => Promise<void>;
  locales: NoteLocales;
}> = ({ open, onClose, entity, onEdit, locales }) => {
  const theme = useTheme();
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
    } catch (error) {
      enqueueSnackbar(locales.getGenericErrorMessage(), { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" color={theme.palette.primary.dark}>
          <Typography variant="h4">{locales.editModalTitle}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TextFieldStyled
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
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1, pb: 3 }}>
        <RoundedButton onClick={onClose} variant="outlined" sx={{ color: 'indigo', borderColor: 'indigo', mr: 1 }}>
          {locales.getLeaveButtonText()}
        </RoundedButton>
        <RoundedButton
          disabled={!editedText || isSaving}
          onClick={handleSave}
          variant="contained"
          sx={{ bgcolor: 'indigo', '&:hover': { bgcolor: 'indigo' } }}
          startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {locales.getSaveButtonText(isSaving)}
        </RoundedButton>
      </DialogActions>
    </Dialog>
  );
};
