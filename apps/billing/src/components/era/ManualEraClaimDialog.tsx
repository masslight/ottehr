import { Close as CloseIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { ReactElement, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { ClaimForm, claimProblems } from '../../utils/manualEra';
import { EraClaimEditor } from './EraClaimEditor';

// "Enter ERA Claim Details": keys in one claim of the remit. A claim picked from the claims list comes
// in pre-filled and is added matched to it; otherwise it is added unmatched.
export function ManualEraClaimDialog({
  initialClaim,
  onCancel,
  onAdd,
}: {
  initialClaim: ClaimForm;
  onCancel: () => void;
  // saves the claim to the remit; a rejection is shown and the dialog stays open
  onAdd: (claim: ClaimForm) => Promise<void>;
}): ReactElement {
  const [claim, setClaim] = useState(initialClaim);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = claimProblems(claim);

  const handleAdd = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      await onAdd(claim);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to add the claim to the remit' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onCancel} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="span" variant="h5" color="primary.dark" fontWeight={600}>
          Enter ERA Claim Details
        </Typography>
        <IconButton size="small" onClick={onCancel} aria-label="Close" disabled={saving}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {claim.matchedClaimId
            ? `Key in this claim's remittance details from the paper/PDF ERA. It is added to the remit matched to claim ${claim.matchedClaimId}.`
            : "Key in one claim's remittance details from the paper/PDF ERA. It is added to the remit as an unmatched claim; you can match it to a claim later."}
        </Typography>
        <Box sx={{ pt: 1 }}>
          <EraClaimEditor claim={claim} onChange={setClaim} />
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button onClick={onCancel} disabled={saving} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Tooltip
          title={
            problems.length ? (
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </Box>
            ) : (
              ''
            )
          }
        >
          <span>
            <Button
              variant="contained"
              onClick={() => void handleAdd()}
              disabled={saving || problems.length > 0}
              startIcon={saving ? <CircularProgress size={14} /> : null}
            >
              {saving ? 'Adding...' : 'Add to Remit'}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}
