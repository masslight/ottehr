import { Close as CloseIcon } from '@mui/icons-material';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { ReactElement, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BillingClaimItem, ClaimDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { getBillingClaimDetail } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { ClaimSearchList } from '../ClaimSearchList';

// Step one of adding a remit claim for a claim already in the system: find the claim. The caller
// then opens the claim details dialog pre-filled from it.
export function AssociateClaimDialog({
  claimsOnRemit,
  onCancel,
  onSelected,
}: {
  // claim ids already on this remit; they can't be added twice
  claimsOnRemit: Set<string>;
  onCancel: () => void;
  onSelected: (claim: ClaimDetailResponse) => void;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [selected, setSelected] = useState<BillingClaimItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unavailable = new Map([...claimsOnRemit].map((id) => [id, 'Already on this remit']));

  const handleContinue = async (): Promise<void> => {
    if (!oystehrZambda || !selected) return;
    setLoading(true);
    setError(null);
    try {
      onSelected(await getBillingClaimDetail(oystehrZambda, { claimId: selected.id }));
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load the claim' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onClose={onCancel} maxWidth={false} PaperProps={{ sx: { width: 680, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="span" variant="h5">
          Add an existing claim
        </Typography>
        <IconButton size="small" onClick={onCancel} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Find the claim this remit adjudicates. Its patient and service lines are filled in for you to key the payer's
          adjudication against, and it is added to the remit matched.
        </Typography>
        <ClaimSearchList selectedId={selected?.id ?? null} onSelect={setSelected} unavailable={unavailable} />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button onClick={onCancel} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleContinue()}
          disabled={!selected || loading}
          startIcon={loading ? <CircularProgress size={14} /> : null}
        >
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
}
