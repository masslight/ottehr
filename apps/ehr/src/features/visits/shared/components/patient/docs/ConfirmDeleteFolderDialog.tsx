import { Box, Typography } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';

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
    <AppDialog
      variant="destructive"
      open={open}
      onClose={onClose}
      title="Delete Folder"
      primary={{ label: 'Delete', onClick: () => void handleConfirm(), loading: isSubmitting }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box>
          {`Are you sure you want to delete the folder ${folderName}?`}
          <br />
          This action cannot be undone.
          <br />
          The folder will remain for the patients who have docs in it.
        </Box>
        {serverError && (
          <Typography variant="body2" color="error">
            {serverError}
          </Typography>
        )}
      </Box>
    </AppDialog>
  );
};
