import { Close as CloseIcon } from '@mui/icons-material';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { WorkQueue } from 'utils/lib/types/data/billing/work-queue.schemas';
import { saveBillingWorkQueue } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { useWorkQueueOwners } from '../../hooks/useWorkQueueOwners';
import { WorkQueueDetails, WorkQueueDetailsFields, workQueueNameError } from './WorkQueueDetailsFields';

const EMPTY_DETAILS: WorkQueueDetails = { name: '', description: '', owner: null };

interface CreateWorkQueueDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (queue: WorkQueue) => void;
}

// Creates an empty work queue (no filters yet); the queue's page is where its claims get picked.
export function CreateWorkQueueDialog({ open, onClose, onCreated }: CreateWorkQueueDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const { owners, loading: ownersLoading } = useWorkQueueOwners(open);
  const [details, setDetails] = useState<WorkQueueDetails>(EMPTY_DETAILS);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDetails(EMPTY_DETAILS);
    setShowErrors(false);
    setError(null);
  }, [open]);

  const handleCreate = async (): Promise<void> => {
    setShowErrors(true);
    if (!oystehrZambda || workQueueNameError(details.name)) return;
    setSaving(true);
    setError(null);
    try {
      const { queue } = await saveBillingWorkQueue(oystehrZambda, {
        name: details.name.trim(),
        description: details.description.trim() || undefined,
        owner: details.owner ?? undefined,
        filters: {},
        layout: {},
      });
      onCreated(queue);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to create the work queue' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Create Work Queue
        <IconButton size="small" onClick={onClose} disabled={saving} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {/* Room for the first field's floating label, which DialogContent's top padding would clip. */}
        <Box sx={{ pt: 1 }}>
          <WorkQueueDetailsFields
            value={details}
            onChange={setDetails}
            owners={owners}
            ownersLoading={ownersLoading}
            showErrors={showErrors}
            disabled={saving}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleCreate()} disabled={saving}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
