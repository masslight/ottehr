import { Close as CloseIcon, DeleteForever as DeleteForeverIcon } from '@mui/icons-material';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { ReactElement, useCallback, useState } from 'react';

export function DeleteDialog({
  open,
  title,
  message,
  buttonText,
  buttonTextInProgress,
  onClose,
  onDelete,
}: {
  open: boolean;
  title: string;
  message: string;
  buttonText?: string;
  buttonTextInProgress?: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
}): ReactElement {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError('');
    try {
      await onDelete();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(JSON.stringify(err));
      }
    } finally {
      setSubmitting(false);
    }
  }, [onDelete]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="span" variant="h5">
          {title}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        {message}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={submitting ? <CircularProgress size={14} /> : <DeleteForeverIcon fontSize="small" />}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? buttonTextInProgress ?? 'Deleting...' : buttonText ?? 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
