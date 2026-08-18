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
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BillingClaimItem } from 'utils/lib/types/data/billing/billing.types';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { matchClaimResponseToClaim, searchBillingClaims } from '../api/api';
import { formatAntCaseString } from '../constants/claimStatus';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';
import { Meta } from '../pages/ClaimDetail';

interface Props {
  claimResponseId: string;
  onClose: () => void;
  onMatched: () => void;
}

interface FormData {
  searchText: string;
}

export function MatchClaimDialog({ claimResponseId, onMatched, onClose }: Props): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<FormData>({ defaultValues: { searchText: '' } });
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
    subscribe,
  } = methods;

  const [error, setError] = useState<string | null>(null);
  const [claims, setClaims] = useState<BillingClaimItem[]>([]);
  const [claim, setClaim] = useState<BillingClaimItem | null>(null);
  const [claimLoading, setClaimLoading] = useState<boolean>(false);

  const { debounce } = useDebounce();

  subscribe({
    formState: {
      values: true,
    },
    callback: ({ values }) => {
      debounce(async () => {
        const searchText = values.searchText;
        if (!oystehrZambda) return;
        if (!searchText) {
          setClaims([]);
          setClaim(null);
          setError(null);
          return;
        }
        try {
          setError(null);
          setClaims([]);
          setClaim(null);
          setClaimLoading(true);
          const data = await searchBillingClaims(oystehrZambda, { searchText, pageSize: 25 });
          setClaims(data.claims);
          if (data.claims.length === 0) setError('Claim not found');
        } catch (err) {
          setClaims([]);
          setError(getApiError({ error: err, defaultError: 'Failed to search claims' }));
        } finally {
          setClaimLoading(false);
        }
      });
    },
  });

  const handleMatch = async (_data: FormData): Promise<void> => {
    if (!oystehrZambda || !claim) return;
    setError(null);
    try {
      await matchClaimResponseToClaim(oystehrZambda, {
        claimResponseId,
        claimId: claim.id,
      });
      onClose();
      onMatched();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to match' }));
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
          <FormProvider {...methods}>
            <Box sx={{ display: 'flex', gap: 5, mt: 1 }}>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Controller
                  name="searchText"
                  control={control}
                  rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <TextField
                      size="small"
                      fullWidth
                      label="Patient name or claim ID"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      error={!!fieldError}
                      helperText={
                        fieldError?.message ?? 'Patient names match from the start. Claim IDs must be entered in full.'
                      }
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            {claimLoading ? <CircularProgress sx={{ color: 'text.secondary' }} size={18} /> : null}
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
                {claims.length > 0 && (
                  <List disablePadding sx={{ maxHeight: 240, overflowY: 'auto', border: 1, borderColor: 'divider' }}>
                    {claims.map((option) => (
                      <ListItemButton
                        key={option.id}
                        selected={claim?.id === option.id}
                        onClick={() => setClaim(option)}
                      >
                        <ListItemText
                          primary={option.patientName}
                          secondary={`DOB ${option.patientDob || '—'} · DOS ${option.serviceDate || '—'} · Claim ID ${
                            option.id
                          }`}
                          primaryTypographyProps={{ fontWeight: 600 }}
                          secondaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                )}
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
              </Box>
            </Box>
          </FormProvider>
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
            onClick={handleSubmit(handleMatch)}
            disabled={isSubmitting || !claim}
          >
            {isSubmitting ? 'Matching...' : 'Match'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
