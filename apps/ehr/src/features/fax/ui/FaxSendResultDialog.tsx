import { Typography } from '@mui/material';
import { FC } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { FaxRecipientResult } from 'utils/lib/types/api/fax.types';

interface FaxSendResultDialogProps {
  failures: FaxRecipientResult[];
  onClose: () => void;
}

/**
 * Shown when some recipients failed. The successful sends already happened and are not rolled back, so the
 * point of this dialog is to name exactly who did not receive the fax.
 */
export const FaxSendResultDialog: FC<FaxSendResultDialogProps> = ({ failures, onClose }) => {
  return (
    <AppDialog
      variant="alert"
      severity="error"
      open={failures.length > 0}
      onClose={onClose}
      title="Some Faxes Could Not Be Sent"
      dismiss={{ label: 'Close', 'data-testid': dataTestIds.faxResultDialog.closeButton }}
      data-testid={dataTestIds.faxResultDialog.root}
    >
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
    </AppDialog>
  );
};
