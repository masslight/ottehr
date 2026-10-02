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
import { ReactElement, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { useRevealFirstError } from '../../hooks/useRevealFirstError';
import { ClaimForm, claimFormResolver, ClaimFormValues } from '../../utils/manualEra';
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
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<ClaimFormValues>({
    defaultValues: { claim: initialClaim },
    resolver: claimFormResolver,
    // useRevealFirstError takes the cursor to the first field to fix
    shouldFocusError: false,
  });
  const claim = useWatch({ control, name: 'claim' });
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useRevealFirstError(submitCount, errors, contentRef);

  const add = handleSubmit(async (values) => {
    setError(null);
    try {
      await onAdd(values.claim);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to add the claim to the remit' }));
    }
  });

  return (
    <Dialog open onClose={isSubmitting ? undefined : onCancel} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="span" variant="h5" color="primary.dark" fontWeight={600}>
          Enter ERA Claim Details
        </Typography>
        <IconButton size="small" onClick={onCancel} aria-label="Close" disabled={isSubmitting}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent ref={contentRef} sx={{ px: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {claim.matchedClaimId
            ? `Key in this claim's remittance details from the paper/PDF ERA. It is added to the remit matched to claim ${claim.matchedClaimId}.`
            : "Key in one claim's remittance details from the paper/PDF ERA. It is added to the remit as an unmatched claim; you can match it to a claim later."}
        </Typography>
        <Box sx={{ pt: 1 }}>
          <EraClaimEditor
            claim={claim}
            errors={errors.claim}
            // once a save has flagged the claim, its errors follow the edits
            onChange={(next) => setValue('claim', next, { shouldValidate: !!errors.claim })}
          />
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button onClick={onCancel} disabled={isSubmitting} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void add()}
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={14} /> : null}
        >
          {isSubmitting ? 'Adding...' : 'Add to Remit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
