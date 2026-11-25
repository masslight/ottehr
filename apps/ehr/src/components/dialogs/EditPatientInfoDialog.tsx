import { Box, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { AppDialog } from './AppDialog';

interface EditPatientInfoDialogProps {
  title: string;
  modalOpen: boolean;
  onClose: () => void;
  input: ReactElement;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  submitButtonName: string;
  loading: boolean;
  submitDisabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  modalDetails?: ReactElement;
}

export default function EditPatientInfoDialog({
  title,
  modalOpen,
  onClose,
  input,
  onSubmit,
  submitButtonName,
  loading,
  submitDisabled = false,
  error,
  errorMessage,
  modalDetails,
}: EditPatientInfoDialogProps): ReactElement {
  return (
    <AppDialog
      variant="form"
      size="s"
      open={modalOpen}
      onClose={onClose}
      title={title}
      onSubmit={(e) => {
        // The shell's form is `noValidate`; keep the browser's own check of the callers' required inputs.
        if (!e.currentTarget.reportValidity()) {
          e.preventDefault();
          return;
        }
        void onSubmit(e);
      }}
      primary={{ label: submitButtonName, loading, disabled: submitDisabled }}
    >
      {modalDetails}
      <Box sx={{ mt: 1 }}>{input}</Box>
      {error && (
        <Typography color="error" variant="body2" mt={2}>
          {errorMessage}
        </Typography>
      )}
    </AppDialog>
  );
}
