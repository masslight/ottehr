import { enqueueSnackbar } from 'notistack';
import { FC, useRef, useState } from 'react';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { ActionLogEntry } from 'utils/lib/types/api/action-logs.types';
import { retryActionLog } from '../../api/api';
import { AppDialog } from '../../components/dialogs/AppDialog';
import { RoundedButton } from '../../components/RoundedButton';
import { useApiClients } from '../../hooks/useAppClients';
import { ACTION_LOG_CHANNEL_COPY } from './actionLogs.constants';

interface RetryActionButtonProps {
  log: ActionLogEntry;
  onResent: () => void;
}

export const RetryActionButton: FC<RetryActionButtonProps> = ({ log, onResent }) => {
  const { oystehrZambda } = useApiClients();
  const [open, setOpen] = useState(false);
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
    <>
      <RoundedButton variant="outlined" onClick={() => setOpen(true)} disabled={isPending} loading={isPending}>
        Try again
      </RoundedButton>
      <AppDialog
        variant="confirm"
        open={open}
        onClose={() => setOpen(false)}
        title={`Resend ${channelCopy.title}`}
        primary={{
          label: 'Resend',
          // handleResend reports its own errors and never rejects, so the dialog closes either way, as before.
          onClick: async () => {
            await handleResend();
            setOpen(false);
          },
          disabled: isPending,
          loading: isPending,
        }}
      >
        {`Resend ${channelCopy.label}${
          log.recipientName ? ` to ${log.recipientName}` : ''
        } to the original ${channelCopy.addressLabel.toLowerCase()}: ${address}.`}
      </AppDialog>
    </>
  );
};
