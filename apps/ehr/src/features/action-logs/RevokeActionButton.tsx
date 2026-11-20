import { enqueueSnackbar } from 'notistack';
import { FC, useRef, useState } from 'react';
import { revokeActionLog } from 'src/api/api';
import { ActionLogEntry } from 'utils/lib/types/api/action-logs.types';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { RoundedButton } from '../../components/RoundedButton';
import { useApiClients } from '../../hooks/useAppClients';

interface RevokeActionButtonProps {
  log: ActionLogEntry;
  onRevoked: () => void;
}

/** Kills an emailed document link, for a send that went to the wrong address or should no longer be open. */
export const RevokeActionButton: FC<RevokeActionButtonProps> = ({ log, onRevoked }) => {
  const { oystehrZambda } = useApiClients();
  const [isPending, setIsPending] = useState(false);
  const isPendingRef = useRef(false);

  const handleRevoke = async (): Promise<void> => {
    if (!oystehrZambda || isPendingRef.current) return;
    isPendingRef.current = true;
    setIsPending(true);
    try {
      await revokeActionLog(oystehrZambda, { attemptId: log.attemptId });
      enqueueSnackbar('Link revoked.', { variant: 'success' });
      onRevoked();
    } catch (error) {
      console.error('Failed to revoke document link', error);
      enqueueSnackbar('Could not revoke this link. Please try again.', { variant: 'error' });
    } finally {
      isPendingRef.current = false;
      setIsPending(false);
    }
  };

  return (
    <ConfirmationDialog
      title="Revoke link"
      description={`The link emailed to ${log.recipientAddress} will stop opening, and an expired link will no longer re-send.`}
      response={handleRevoke}
      actionButtons={{
        proceed: { text: 'Revoke', color: 'error', disabled: isPending, loading: isPending },
        back: { text: 'Cancel' },
        reverse: true,
      }}
    >
      {(showDialog) => (
        <RoundedButton variant="outlined" color="error" onClick={showDialog} disabled={isPending} loading={isPending}>
          Revoke
        </RoundedButton>
      )}
    </ConfirmationDialog>
  );
};
