import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { ReactElement, ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  // Inputs and alerts shown below the message, outside its paragraph.
  fields?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'primary' | 'error';
  confirmDisabled?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  fields,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'primary',
  confirmDisabled = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): ReactElement {
  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle
        sx={{
          px: 3,
          pt: 3,
          pb: 1.5,
        }}
      >
        {title}
      </DialogTitle>
      <DialogContent sx={{ px: 3 }}>
        <DialogContentText variant="body2">{children}</DialogContentText>
        {fields}
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          pb: 2.5,
          pt: 1,
        }}
      >
        <Button
          size="small"
          onClick={onCancel}
          disabled={loading}
          sx={{
            mr: 'auto',
          }}
        >
          {cancelLabel}
        </Button>
        <Button
          size="small"
          variant="contained"
          color={confirmColor}
          onClick={onConfirm}
          disabled={loading || confirmDisabled}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
