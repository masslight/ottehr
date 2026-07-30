import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { FaxRecipientResult, formatPhoneNumberDisplay } from 'utils';

interface FaxSendResultDialogProps {
  failures: FaxRecipientResult[];
  onClose: () => void;
}

/**
 * Shown when some recipients failed. The successful sends already happened and are not rolled back, so the
 * point of this dialog is to name exactly who did not receive the fax.
 */
export const FaxSendResultDialog: FC<FaxSendResultDialogProps> = ({ failures, onClose }) => {
  const theme = useTheme();

  return (
    <Dialog
      open={failures.length > 0}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      data-testid={dataTestIds.faxResultDialog.root}
    >
      <DialogTitle sx={{ color: theme.palette.primary.dark, fontWeight: 600, fontSize: '24px' }}>
        Some faxes could not be sent
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>The following recipient(s) could not be reached:</Typography>
        {failures.map((failure, index) => (
          <Typography
            key={`${failure.faxNumber}-${index}`}
            sx={{ fontWeight: 600, mb: 1 }}
            data-testid={dataTestIds.faxResultDialog.failedRecipient}
          >
            {failure.name || 'Unnamed recipient'} — {formatPhoneNumberDisplay(failure.faxNumber)}
          </Typography>
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          variant="contained"
          onClick={onClose}
          sx={{ borderRadius: '100px', textTransform: 'none', fontWeight: 500 }}
          data-testid={dataTestIds.faxResultDialog.closeButton}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
