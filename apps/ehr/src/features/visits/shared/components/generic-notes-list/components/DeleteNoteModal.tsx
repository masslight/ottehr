import { Box } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { EditableNote, NoteLocales } from '../types';

const MINOR_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'by',
  'to',
  'of',
  'for',
  'in',
  'on',
  'at',
  'as',
  'with',
  'from',
]);

// The locales build the title from a lower-case entity label ("Delete intake note").
const toTitleCase = (text: string): string =>
  text
    .split(' ')
    .map((word, index, words) =>
      index > 0 && index < words.length - 1 && MINOR_WORDS.has(word.toLowerCase())
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');

export const DeleteNoteModal: React.FC<{
  open: boolean;
  onClose: () => void;
  entity: EditableNote;
  onDelete: (entity: EditableNote) => Promise<void>;
  locales: NoteLocales;
}> = ({ open, onClose, entity, onDelete, locales }) => {
  const [error, setError] = useState<string>();

  const handleDelete = async (): Promise<void> => {
    const errorMessage = locales.getErrorMessage('deletion', locales.entityLabel);
    setError(undefined);
    try {
      await onDelete(entity);
      onClose();
    } catch {
      setError(errorMessage);
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  return (
    <AppDialog
      variant="destructive"
      open={open}
      onClose={onClose}
      title={toTitleCase(locales.getDeleteModalTitle(locales.entityLabel))}
      dismiss={{ label: locales.getKeepButtonText() }}
      primary={{ label: locales.getDeleteButtonText(false), onClick: handleDelete }}
    >
      <Box data-testid={dataTestIds.dialog.inPersonModalContent}>
        <Box>{locales.getDeleteModalContent(locales.entityLabel)}</Box>
        <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1} whiteSpace="pre-wrap">
          {entity.text}
        </Box>
        {error && (
          <Box mt={2} color="error.main">
            {error}
          </Box>
        )}
      </Box>
    </AppDialog>
  );
};
