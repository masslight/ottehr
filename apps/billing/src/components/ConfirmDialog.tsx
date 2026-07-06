import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { ReactElement, ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'primary' | 'error';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'primary',
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
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          pb: 2.5,
          pt: 1,
        }}
      >
        <Button size="small" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button size="small" variant="contained" color={confirmColor} onClick={onConfirm} disabled={loading}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
