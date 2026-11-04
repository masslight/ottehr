import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import { Alert, Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { otherColors } from 'utils/lib/theme/billing-palette';
import { ClaimsListViewConfig, isSameClaimsListView } from 'utils/lib/types/data/billing/claims-list-view.schemas';
import { WorkQueue } from 'utils/lib/types/data/billing/work-queue.schemas';
import { getBillingWorkQueue, saveBillingWorkQueue } from '../api/api';
import {
  WorkQueueDetails,
  WorkQueueDetailsFields,
  workQueueNameError,
} from '../components/work-queue/WorkQueueDetailsFields';
import { useApiClients } from '../hooks/useAppClients';
import { useWorkQueueOwners } from '../hooks/useWorkQueueOwners';
import { ClaimsListView, ClaimsListViewState } from './ClaimsList';

const detailsOf = (queue: WorkQueue): WorkQueueDetails => ({
  name: queue.name,
  description: queue.description ?? '',
  owner: queue.owner ?? null,
});

const sameDetails = (a: WorkQueueDetails, b: WorkQueueDetails): boolean =>
  a.name.trim() === b.name.trim() &&
  a.description.trim() === b.description.trim() &&
  a.owner?.practitionerId === b.owner?.practitionerId;

// A work queue: the claims list as the queue saved it (filters, column order, sort), plus its name,
// description, and owner. Changes stay local until Save writes them for everyone.
export default function WorkQueueDetail(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const { owners, loading: ownersLoading } = useWorkQueueOwners();

  const [saved, setSaved] = useState<WorkQueue | null>(null);
  const [details, setDetails] = useState<WorkQueueDetails>({ name: '', description: '', owner: null });
  const [view, setView] = useState<ClaimsListViewConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const fetchQueue = useCallback(async (): Promise<void> => {
    if (!oystehrZambda || !id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { queue } = await getBillingWorkQueue(oystehrZambda, { queueId: id });
      setSaved(queue);
      setDetails(detailsOf(queue));
      setView({ filters: queue.filters, layout: queue.layout });
    } catch (err) {
      setLoadError(getApiError({ error: err, defaultError: 'Failed to load the work queue' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const handleViewChange = useCallback((state: ClaimsListViewState): void => {
    setView({ filters: state.filters, layout: state.layout });
  }, []);

  const dirty =
    !!saved &&
    !!view &&
    (!sameDetails(details, detailsOf(saved)) ||
      !isSameClaimsListView(view, { filters: saved.filters, layout: saved.layout }));

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent): void => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const handleSave = async (): Promise<void> => {
    setShowErrors(true);
    if (!oystehrZambda || !saved || !view || workQueueNameError(details.name)) return;
    setSaving(true);
    try {
      const { queue } = await saveBillingWorkQueue(oystehrZambda, {
        queueId: saved.id,
        name: details.name.trim(),
        description: details.description.trim() || undefined,
        owner: details.owner,
        filters: view.filters,
        layout: view.layout,
      });
      setSaved(queue);
      setDetails(detailsOf(queue));
      setShowErrors(false);
      enqueueSnackbar('Work queue saved.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getApiError({ error: err, defaultError: 'Failed to save the work queue' }), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const backButton = (
    <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/work-queues')} sx={{ mb: 1 }}>
      Work Queues
    </Button>
  );

  if (loading || (!saved && !loadError)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!saved) {
    return (
      <Box>
        {backButton}
        <Alert severity="error">{loadError}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {backButton}
      <Box
        sx={{
          bgcolor: 'background.paper',
          border: `1px solid ${otherColors.lightDivider}`,
          borderRadius: 2,
          p: 2,
          pt: 2.5,
          mb: 3,
        }}
      >
        <WorkQueueDetailsFields
          value={details}
          onChange={setDetails}
          owners={owners}
          ownersLoading={ownersLoading}
          showErrors={showErrors}
          disabled={saving}
          inline
        />
      </Box>
      <ClaimsListView
        key={saved.id}
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Typography variant="h4" color="primary.dark" fontWeight={600} noWrap>
              {details.name.trim() || saved.name}
            </Typography>
            {dirty && <Chip label="Unsaved changes" size="small" color="warning" variant="outlined" />}
          </Box>
        }
        actions={
          <Button
            variant="outlined"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
          >
            Save
          </Button>
        }
        initialFilters={saved.filters}
        initialLayout={saved.layout}
        onStateChange={handleViewChange}
      />
    </Box>
  );
}
