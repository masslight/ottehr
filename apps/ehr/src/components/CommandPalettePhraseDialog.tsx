import { Box, TextField } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Phrase } from 'utils/lib/fhir/practitioners';
import { useSavePhrases } from '../hooks/usePhraseMutations';
import { usePhrases } from '../hooks/usePhrases';
import { useCommandPaletteStore } from '../state/command-palette.store';
import { CustomDialog } from './dialogs/CustomDialog';

/**
 * Mounts the phrase new/edit/delete dialogs at App level so the command palette's
 * "Phrases" rows can open them from anywhere. Rendered only while a mode is set.
 */
export const CommandPalettePhraseDialog: FC = () => {
  const phraseDialog = useCommandPaletteStore((state) => state.phraseDialog);
  const setPhraseDialog = useCommandPaletteStore((state) => state.setPhraseDialog);
  const phrases = usePhrases();
  const { mutateAsync: savePhrases, isPending } = useSavePhrases();

  // The targeted phrase can disappear under an open edit/delete dialog (e.g. deleted from another tab).
  const targetIndex = phraseDialog && phraseDialog.mode !== 'new' ? phraseDialog.index : undefined;
  const phraseMissing = targetIndex !== undefined && phrases[targetIndex] === undefined;

  useEffect(() => {
    if (phraseMissing) {
      setPhraseDialog(null);
      enqueueSnackbar('That phrase no longer exists.', { variant: 'error' });
    }
  }, [phraseMissing, setPhraseDialog]);

  if (!phraseDialog || phraseMissing) {
    return null;
  }

  const close = (): void => setPhraseDialog(null);

  if (phraseDialog.mode === 'delete') {
    const handleDelete = async (): Promise<void> => {
      await savePhrases(phrases.filter((_phrase, index) => index !== phraseDialog.index));
      close();
      enqueueSnackbar('Phrase deleted', { variant: 'success' });
    };

    return (
      <CustomDialog
        open
        handleClose={close}
        title="Delete phrase?"
        description={`"${
          phrases[phraseDialog.index].key
        }" will be removed from your phrases. Text already inserted into notes is not affected.`}
        confirmText="Delete"
        closeButtonText="Cancel"
        confirmLoading={isPending}
        // useSavePhrases.onError already surfaced the error; this only prevents an unhandled rejection.
        handleConfirm={() => void handleDelete().catch(() => undefined)}
      />
    );
  }

  const editIndex = phraseDialog.mode === 'edit' ? phraseDialog.index : undefined;
  const handleSave = async (phrase: Phrase): Promise<void> => {
    const nextPhrases =
      editIndex === undefined
        ? [...phrases, phrase]
        : phrases.map((existing, index) => (index === editIndex ? phrase : existing));
    await savePhrases(nextPhrases);
    close();
    enqueueSnackbar('Phrase saved', { variant: 'success' });
  };

  return (
    <PhraseFormDialog
      key={editIndex ?? 'new'}
      initialPhrase={editIndex === undefined ? undefined : phrases[editIndex]}
      otherKeys={phrases.filter((_phrase, index) => index !== editIndex).map((phrase) => phrase.key)}
      saving={isPending}
      onCancel={close}
      onSave={handleSave}
    />
  );
};

interface PhraseFormDialogProps {
  initialPhrase?: Phrase;
  otherKeys: string[];
  saving: boolean;
  onCancel: () => void;
  onSave: (phrase: Phrase) => Promise<void>;
}

const PhraseFormDialog: FC<PhraseFormDialogProps> = ({ initialPhrase, otherKeys, saving, onCancel, onSave }) => {
  const [key, setKey] = useState(initialPhrase?.key ?? '');
  const [value, setValue] = useState(initialPhrase?.value ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const trimmedKey = key.trim();
  const normalizedKey = trimmedKey.toLowerCase();
  const keyError = !trimmedKey
    ? 'Enter a key'
    : otherKeys.some((otherKey) => otherKey.trim().toLowerCase() === normalizedKey)
    ? 'You already have a phrase with this key'
    : undefined;
  const valueError = !value.trim() ? 'Enter the text to insert' : undefined;

  const submit = (): void => {
    setShowErrors(true);
    if (keyError || valueError || saving) return;
    // useSavePhrases.onError already surfaced the error; this only prevents an unhandled rejection.
    void onSave({ key: trimmedKey, value }).catch(() => undefined);
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };

  const handleKeyFieldKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      textRef.current?.focus();
    }
  };

  return (
    <CustomDialog
      open
      handleClose={onCancel}
      title={initialPhrase ? 'Edit phrase' : 'New phrase'}
      description={
        <Box sx={{ width: '436px', display: 'flex', flexDirection: 'column', gap: 2 }} onKeyDown={handleDialogKeyDown}>
          <TextField
            sx={{ mt: 0.5 }}
            label="Key"
            autoFocus
            fullWidth
            value={key}
            onChange={(event) => setKey(event.target.value)}
            onKeyDown={handleKeyFieldKeyDown}
            error={showErrors && !!keyError}
            helperText={showErrors ? keyError : undefined}
          />
          <TextField
            label="Text"
            fullWidth
            multiline
            minRows={4}
            inputRef={textRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            error={showErrors && !!valueError}
            helperText={showErrors ? valueError : undefined}
          />
        </Box>
      }
      handleConfirm={submit}
      confirmText="Save"
      confirmLoading={saving}
      closeButtonText="Cancel"
    />
  );
};
