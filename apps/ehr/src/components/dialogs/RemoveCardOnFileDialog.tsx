import { Alert, Typography } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { AppDialog } from './AppDialog';

interface RemoveCardOnFileDialogProps {
  open: boolean;
  onClose: () => void;
  onRemove: () => void;
  loading?: boolean;
  canRemove?: boolean;
}

export default function RemoveCardOnFileDialog({
  open,
  onClose,
  onRemove,
  loading,
  canRemove = true,
}: RemoveCardOnFileDialogProps): ReactElement {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) setConfirming(false);
  }, [open]);

  if (confirming) {
    return (
      <AppDialog
        variant="destructive"
        open={open}
        onClose={onClose}
        title="Confirm Card Removal"
        primary={{ label: 'Remove Card', onClick: onRemove, loading }}
        dismiss={{ label: 'Back', onClick: () => setConfirming(false) }}
      >
        Remove the card on file? The patient will need to add a new card to re-enable automatic charging.
      </AppDialog>
    );
  }

  return (
    <AppDialog
      variant="destructive"
      open={open}
      onClose={onClose}
      title="Card on File"
      busy={loading}
      primary={{ label: 'Remove Card on File', onClick: () => setConfirming(true), disabled: !canRemove }}
    >
      <Typography variant="body2" sx={{ mb: 2 }}>
        This card is used to automatically charge invoices when they come due.
      </Typography>
      <Alert severity="warning">Removing it means invoices will no longer be charged automatically.</Alert>
      {!canRemove && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Only users with the Billing Admin role can remove the card on file
        </Typography>
      )}
    </AppDialog>
  );
}
