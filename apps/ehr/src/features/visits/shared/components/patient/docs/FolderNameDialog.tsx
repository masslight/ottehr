import { Box, TextField } from '@mui/material';
import { ChangeEvent, FC, useEffect, useState } from 'react';
import { CustomDialog } from 'src/components/dialogs';
import { RoundedButton } from 'src/components/RoundedButton';
import { InfoAlert } from 'src/features/visits/in-person/components/InfoAlert';

const FOLDER_NAME_REGEX = /^[a-zA-Z0-9+!\-_'()\\.@$ ]+$/;
const MAX_NAME_LENGTH = 60;

type FolderNameDialogProps = {
  open: boolean;
  mode: 'create' | 'rename';
  initialName?: string;
  existingNames: string[];
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
};

export const FolderNameDialog: FC<FolderNameDialogProps> = ({
  open,
  mode,
  initialName = '',
  existingNames,
  onSubmit,
  onClose,
}) => {
  const [value, setValue] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayMode, setDisplayMode] = useState(mode);

  useEffect(() => {
    if (open) {
      setValue(initialName);
      setError(null);
      setServerError(null);
      setDisplayMode(mode);
    }
  }, [open, initialName, mode]);

  const validate = (name: string): string | null => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return 'Folder name is required';
    if (trimmed.length > MAX_NAME_LENGTH) return `Folder name must be ${MAX_NAME_LENGTH} characters or fewer`;
    if (!FOLDER_NAME_REGEX.test(trimmed)) {
      return "Only letters, numbers, spaces, and these characters are allowed: + ! - _ ' ( ) . @ $";
    }
    const lower = trimmed.toLowerCase();
    const isDuplicate = existingNames.some((existing) => {
      if (mode === 'rename' && existing.toLowerCase() === initialName.toLowerCase()) return false;
      return existing.toLowerCase() === lower;
    });
    if (isDuplicate) return 'A folder with this name already exists';
    return null;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const newValue = e.target.value;
    setValue(newValue);
    setError(validate(newValue));
    setServerError(null);
  };

  const handleSubmit = async (): Promise<void> => {
    const validationError = validate(value);
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSubmitting(true);
    setServerError(null);
    try {
      await onSubmit(value.trim());
      onClose();
    } catch (err: any) {
      const msg = err?.message ?? 'An error occurred. Please try again.';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = !validate(value);

  return (
    <CustomDialog
      open={open}
      handleClose={onClose}
      title={displayMode === 'create' ? 'New Folder' : 'Rename Folder'}
      description={
        <Box sx={{ width: '436px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {displayMode === 'create' && <InfoAlert text="New folder will appear for all patients." persistent />}
          <TextField
            autoFocus
            fullWidth
            label="Folder Name"
            required
            value={value}
            onChange={handleChange}
            error={Boolean(error || serverError)}
            helperText={error ?? serverError ?? ' '}
            inputProps={{ maxLength: MAX_NAME_LENGTH + 10 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isValid && !isSubmitting) {
                void handleSubmit();
              }
            }}
          />
        </Box>
      }
      actions={
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <RoundedButton onClick={onClose} disabled={isSubmitting}>
            Cancel
          </RoundedButton>
          <RoundedButton
            variant="contained"
            onClick={() => void handleSubmit()}
            loading={isSubmitting}
            disabled={!isValid}
          >
            {displayMode === 'create' ? 'Create' : 'Save'}
          </RoundedButton>
        </Box>
      }
    />
  );
};
