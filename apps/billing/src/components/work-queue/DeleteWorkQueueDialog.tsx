import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { WorkQueue } from 'utils/lib/types/data/billing/work-queue.schemas';
import { deleteBillingWorkQueue } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { ConfirmDialog } from '../ConfirmDialog';

interface DeleteWorkQueueDialogProps {
  // The queue to delete; the dialog is open while it's set.
  queue: Pick<WorkQueue, 'id' | 'name'> | null;
  onClose: () => void;
  onDeleted: () => void;
}

// Asks before deleting a work queue. Deleting the queue leaves its claims untouched.
export function DeleteWorkQueueDialog({ queue, onClose, onDeleted }: DeleteWorkQueueDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [deleting, setDeleting] = useState(false);
  // Keeps the name on screen while the dialog fades out after `queue` is cleared.
  const [shown, setShown] = useState(queue);
  if (queue && queue !== shown) setShown(queue);

  const handleDelete = async (): Promise<void> => {
    if (!oystehrZambda || !queue) return;
    setDeleting(true);
    try {
      await deleteBillingWorkQueue(oystehrZambda, { queueId: queue.id });
      enqueueSnackbar('Work queue deleted.', { variant: 'success' });
      onDeleted();
    } catch (err) {
      enqueueSnackbar(getApiError({ error: err, defaultError: 'Failed to delete the work queue' }), {
        variant: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ConfirmDialog
      open={!!queue}
      title="Delete work queue?"
      confirmLabel={deleting ? 'Deleting...' : 'Delete'}
      confirmColor="error"
      loading={deleting}
      onConfirm={() => void handleDelete()}
      onCancel={onClose}
    >
      The work queue <strong>{shown?.name}</strong> will be deleted for everyone. Its claims will not be affected. This
      cannot be undone.
    </ConfirmDialog>
  );
}
