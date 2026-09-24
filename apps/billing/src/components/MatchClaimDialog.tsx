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
  Typography,
} from '@mui/material';
import { ReactElement, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BillingClaimItem, EraClaimListItem } from 'utils/lib/types/data/billing/billing.types';
import { formatAntCaseString } from 'utils/lib/types/data/billing/claim-status';
import { formatCurrency } from 'utils/lib/utils/convert';
import { matchClaimResponseToClaim } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { Meta } from '../pages/ClaimDetail';
import { ClaimSearchList } from './ClaimSearchList';

interface Props {
  claimResponseId: string;
  eraClaim: EraClaimListItem;
  onClose: () => void;
  onMatched: () => void;
}

export function MatchClaimDialog({ claimResponseId, eraClaim, onMatched, onClose }: Props): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [error, setError] = useState<string | null>(null);
  const [claim, setClaim] = useState<BillingClaimItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMatch = async (): Promise<void> => {
    if (!oystehrZambda || !claim) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await matchClaimResponseToClaim(oystehrZambda, {
        claimResponseId,
        claimId: claim.id,
      });
      onClose();
      onMatched();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to match' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={true} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 680, maxWidth: '95vw' } }}>
        <DialogTitle
          sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography component="span" variant="h5">
            Match to claim
          </Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 0 }}>
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
              ERA details
            </Typography>
            <Typography variant="h5" color="primary.dark" fontWeight={600}>
              {eraClaim.patientName}
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, mt: 0.5, flexWrap: 'wrap' }}>
              <Meta label="Date of Service" value={eraClaim.dos} />
              <Meta label="Patient DOB" value={eraClaim.patientDob} />
              <Meta label="Billed" value={formatCurrency(eraClaim.billed)} />
              <Meta label="Allowed" value={formatCurrency(eraClaim.allowed)} />
              <Meta label="Ins Paid" value={formatCurrency(eraClaim.paid)} />
              <Meta label="Patient Resp" value={formatCurrency(eraClaim.patientResp)} />
              <Meta label="Patient Account Number" value={eraClaim.patientAccountNumber} />
              <Meta label="Member ID" value={eraClaim.memberId} />
            </Box>
          </Box>
          <ClaimSearchList selectedId={claim?.id ?? null} onSelect={setClaim} />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          {claim ? (
            <Box sx={{ my: 2.5 }}>
              <Typography variant="h5" color="primary.dark" fontWeight={600}>
                {claim.patientName}
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, mt: 0.5, flexWrap: 'wrap' }}>
                <Meta label="Date of Service" value={claim.serviceDate} />
                <Meta label="Claim ID" value={claim.id} />
                <Meta label="Claim Type" value={formatAntCaseString(claim.type)} />
                <Meta label="Service" value={formatAntCaseString(claim.service)} />
                <Meta label="Patient DOB" value={claim.patientDob} />
              </Box>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={isSubmitting ? <CircularProgress size={14} /> : null}
            onClick={() => void handleMatch()}
            disabled={isSubmitting || !claim}
          >
            {isSubmitting ? 'Matching...' : 'Match'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
