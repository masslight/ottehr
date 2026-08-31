import CloseIcon from '@mui/icons-material/Close';
import { LoadingButton } from '@mui/lab';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  useTheme,
} from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';

interface RemoveCardOnFileDialogProps {
  open: boolean;
  onClose: () => void;
  onRemove: () => void;
  loading?: boolean;
}

export default function RemoveCardOnFileDialog({
  open,
  onClose,
  onRemove,
  loading,
}: RemoveCardOnFileDialogProps): ReactElement {
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) setConfirming(false);
  }, [open]);

  const buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      disableScrollLock
      sx={{
        '.MuiPaper-root': {
          padding: 2,
          maxWidth: 480,
        },
      }}
    >
      <IconButton
        aria-label="close"
        onClick={onClose}
        disabled={loading}
        size="medium"
        sx={{ position: 'absolute', right: 12, top: 12 }}
      >
        <CloseIcon fontSize="medium" sx={{ color: '#938B7D' }} />
      </IconButton>
      <DialogTitle variant="h4" color="primary.dark">
        {confirming ? 'Confirm Card Removal' : 'Card on File'}
      </DialogTitle>
      <DialogContent>
        {confirming ? (
          <DialogContentText sx={{ color: theme.palette.text.primary }}>
            Remove the card on file? The patient will need to add a new card to re-enable automatic charging.
          </DialogContentText>
        ) : (
          <>
            <DialogContentText sx={{ color: theme.palette.text.primary, mb: 2 }}>
              This card is used to automatically charge invoices when they come due.
            </DialogContentText>
            <Alert severity="warning">Removing it means invoices will no longer be charged automatically.</Alert>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          variant="outlined"
          onClick={confirming ? () => setConfirming(false) : onClose}
          size="medium"
          sx={buttonSx}
          disabled={loading}
        >
          {confirming ? 'Back' : 'Close'}
        </Button>
        {confirming ? (
          <LoadingButton
            variant="contained"
            color="error"
            size="medium"
            sx={buttonSx}
            loading={loading}
            onClick={onRemove}
          >
            Yes, Remove Card
          </LoadingButton>
        ) : (
          <Button variant="contained" color="error" size="medium" sx={buttonSx} onClick={() => setConfirming(true)}>
            Remove Card on File
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
