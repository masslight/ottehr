import { enqueueSnackbar } from 'notistack';
import { FC } from 'react';
import { FaxLogEntry, formatPhoneNumberDisplay } from 'utils';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { RoundedButton } from '../../components/RoundedButton';
import { useOystehrAPIClient } from '../visits/shared/hooks/useOystehrAPIClient';

interface ResendFaxButtonProps {
  log: FaxLogEntry;
  onResent: () => void;
}

/** Re-sends a failed fax to its original recipient via the existing send-fax zambda. */
export const ResendFaxButton: FC<ResendFaxButtonProps> = ({ log, onResent }) => {
  const apiClient = useOystehrAPIClient();

  if (!log.appointmentId || !log.faxNumber) {
    return null;
  }

  const handleResend = async (): Promise<void> => {
    if (!apiClient || !log.appointmentId || !log.faxNumber) {
      throw new Error('api client not defined or fax details are missing');
    }
    await apiClient.sendFax({
      appointmentId: log.appointmentId,
      // send-fax expects a bare 10-digit number and adds the +1 prefix itself
      faxNumber: log.faxNumber.replace(/\D/g, '').slice(-10),
    });
    enqueueSnackbar('Fax sent.', { variant: 'success' });
    onResent();
  };

  return (
    <ConfirmationDialog
      title="Resend Fax"
      description={`Resend fax${
        log.recipientName ? ` to ${log.recipientName}` : ''
      } to the fax number: ${formatPhoneNumberDisplay(log.faxNumber)}.`}
      response={handleResend}
      actionButtons={{
        proceed: { text: 'Resend' },
        back: { text: 'Cancel' },
        reverse: true,
      }}
    >
      {(showDialog) => (
        <RoundedButton variant="outlined" onClick={showDialog}>
          Try again
        </RoundedButton>
      )}
    </ConfirmationDialog>
  );
};
