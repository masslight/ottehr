import { enqueueSnackbar } from 'notistack';
import { FC, useRef, useState } from 'react';
import { ActionLogEntry, formatPhoneNumberDisplay } from 'utils';
import { retryActionLog } from '../../api/api';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { RoundedButton } from '../../components/RoundedButton';
import { useApiClients } from '../../hooks/useAppClients';
import { ACTION_LOG_CHANNEL_COPY } from './actionLogs.constants';

interface RetryActionButtonProps {
  log: ActionLogEntry;
  onResent: () => void;
}

export const RetryActionButton: FC<RetryActionButtonProps> = ({ log, onResent }) => {
  const { oystehrZambda } = useApiClients();
  const [isPending, setIsPending] = useState(false);
  const isPendingRef = useRef(false);

  const address = log.channel === 'fax' ? formatPhoneNumberDisplay(log.recipientAddress) : log.recipientAddress;
  const channelCopy = ACTION_LOG_CHANNEL_COPY[log.channel];

  const handleResend = async (): Promise<void> => {
    if (!oystehrZambda || isPendingRef.current) return;
    isPendingRef.current = true;
    setIsPending(true);
    try {
      await retryActionLog(oystehrZambda, { attemptId: log.attemptId });
      enqueueSnackbar(`${channelCopy.title} sent.`, { variant: 'success' });
      onResent();
    } catch (error) {
      console.error(`Failed to retry ${log.channel} action log`, error);
      enqueueSnackbar(`Could not retry this ${channelCopy.label}. Please try again.`, { variant: 'error' });
    } finally {
      isPendingRef.current = false;
      setIsPending(false);
    }
  };

  return (
    <ConfirmationDialog
      title={`Resend ${channelCopy.title}`}
      description={`Resend ${channelCopy.label}${
        log.recipientName ? ` to ${log.recipientName}` : ''
      } to the original ${channelCopy.addressLabel.toLowerCase()}: ${address}.`}
      response={handleResend}
      actionButtons={{
        proceed: { text: 'Resend', disabled: isPending, loading: isPending },
        back: { text: 'Cancel' },
        reverse: true,
      }}
    >
      {(showDialog) => (
        <RoundedButton variant="outlined" onClick={showDialog} disabled={isPending} loading={isPending}>
          Try again
        </RoundedButton>
      )}
    </ConfirmationDialog>
  );
};
