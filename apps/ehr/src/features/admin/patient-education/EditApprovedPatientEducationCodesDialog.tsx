import {
  Autocomplete,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { useICD10SearchNew } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { ApprovedPatientEducationItem, IcdSearchResponse } from 'utils';
import { APPROVED_PATIENT_EDUCATION_QUERY_KEY } from './PatientEducationAdminPage';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  item: ApprovedPatientEducationItem;
};

type Diagnosis = IcdSearchResponse['codes'][number];

export const EditApprovedPatientEducationCodesDialog: FC<DialogProps> = ({ open, onClose, item }) => {
  const apiClient = useOystehrAPIClient();
  const queryClient = useQueryClient();

  const initialPrimary = item.icdCodes[0] ?? null;
  const initialAlternates = item.icdCodes.slice(1);

  const [primary, setPrimary] = useState<Diagnosis | null>(
    initialPrimary ? { code: initialPrimary.code, display: initialPrimary.display } : null
  );
  const [alternates, setAlternates] = useState<Diagnosis[]>(
    initialAlternates.map((c) => ({ code: c.code, display: c.display }))
  );

  const [primaryInput, setPrimaryInput] = useState('');
  const [primaryDebounced, setPrimaryDebounced] = useState('');
  const { debounce: debouncePrimary } = useDebounce(800);
  const { data: primaryData, isFetching: isPrimaryFetching } = useICD10SearchNew({ search: primaryDebounced });
  const primaryOptions = primaryData?.codes ?? [];

  const [alternateInput, setAlternateInput] = useState('');
  const [alternateDebounced, setAlternateDebounced] = useState('');
  const { debounce: debounceAlternate } = useDebounce(800);
  const { data: alternateData, isFetching: isAlternateFetching } = useICD10SearchNew({ search: alternateDebounced });
  const alternateOptions = (alternateData?.codes ?? []).filter(
    (o) => o.code !== primary?.code && !alternates.some((a) => a.code === o.code)
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!apiClient) throw new Error('API client not available');
      if (!primary) throw new Error('A diagnosis is required');
      return apiClient.updateApprovedPatientEducationCodes({
        documentReferenceId: item.documentReferenceId,
        icdCodes: [
          { code: primary.code, display: primary.display },
          ...alternates.map((a) => ({ code: a.code, display: a.display })),
        ],
      });
    },
    onSuccess: () => {
      enqueueSnackbar('Updated approved patient education codes', { variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: APPROVED_PATIENT_EDUCATION_QUERY_KEY });
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    },
  });

  const isBusy = saveMutation.isPending;

  return (
    <Dialog open={open} onClose={() => !isBusy && onClose()} maxWidth="md" fullWidth>
      <DialogTitle>Edit Approved Patient Education Codes</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Update the diagnosis or alternative ICD-10 codes for{' '}
            <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
              {item.title}
            </Typography>
            . The PDF content is not changed.
          </Typography>
          <Autocomplete<Diagnosis, false>
            options={primaryOptions}
            loading={isPrimaryFetching}
            filterOptions={(x) => x}
            value={primary}
            onChange={(_e, value) => setPrimary(value)}
            isOptionEqualToValue={(a, b) => a.code === b.code}
            getOptionLabel={(o) => `${o.code} — ${o.display}`}
            inputValue={primaryInput}
            onInputChange={(_e, value) => {
              setPrimaryInput(value);
              debouncePrimary(() => setPrimaryDebounced(value));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                required
                size="small"
                label="Diagnosis"
                placeholder="Start typing to search"
                error={submitAttempted && !primary}
                helperText={submitAttempted && !primary ? 'This field is required' : undefined}
              />
            )}
          />
          <Autocomplete<Diagnosis, true>
            multiple
            options={alternateOptions}
            loading={isAlternateFetching}
            filterOptions={(x) => x}
            value={alternates}
            onChange={(_e, value) => setAlternates(value)}
            isOptionEqualToValue={(a, b) => a.code === b.code}
            getOptionLabel={(o) => `${o.code} — ${o.display}`}
            inputValue={alternateInput}
            onInputChange={(_e, value) => {
              setAlternateInput(value);
              debounceAlternate(() => setAlternateDebounced(value));
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key: _key, ...tagProps } = getTagProps({ index });
                return <Chip key={option.code} label={`${option.code} — ${option.display}`} {...tagProps} />;
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label="Alternative ICD-10 codes"
                placeholder="Start typing to search"
              />
            )}
          />
          {errorMsg && (
            <Typography color="error" variant="body2">
              {errorMsg}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <RoundedButton onClick={onClose} disabled={isBusy}>
          Cancel
        </RoundedButton>
        <RoundedButton
          variant="contained"
          onClick={() => {
            if (!primary) {
              setSubmitAttempted(true);
              return;
            }
            saveMutation.mutate();
          }}
          disabled={isBusy}
          startIcon={isBusy ? <CircularProgress size={16} /> : null}
        >
          Save
        </RoundedButton>
      </DialogActions>
    </Dialog>
  );
};
