import { Box, Typography } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { CustomDialog } from 'src/components/dialogs';
import { RoundedButton } from 'src/components/RoundedButton';

type ConfirmDeleteFolderDialogProps = {
  open: boolean;
  folderName: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

export const ConfirmDeleteFolderDialog: FC<ConfirmDeleteFolderDialogProps> = ({
  open,
  folderName,
  onConfirm,
  onClose,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIsSubmitting(false);
      setServerError(null);
    }
  }, [open]);

  const handleConfirm = async (): Promise<void> => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setServerError(err?.message ?? 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CustomDialog
      open={open}
      handleClose={onClose}
      title="Delete Folder"
      description={
        <Box sx={{ width: '436px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body1">
            {`Are you sure you want to delete the folder ${folderName}?`}
            <br />
            This action cannot be undone.
            <br />
            The folder will remain for the patients who have docs in it.
          </Typography>
          {serverError && (
            <Typography variant="body2" color="error">
              {serverError}
            </Typography>
          )}
        </Box>
      }
      actions={
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <RoundedButton onClick={onClose} disabled={isSubmitting}>
            Cancel
          </RoundedButton>
          <RoundedButton variant="contained" color="error" onClick={() => void handleConfirm()} loading={isSubmitting}>
            Delete
          </RoundedButton>
        </Box>
      }
    />
  );
};
