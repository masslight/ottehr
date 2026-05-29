import { CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { ApprovedPatientEducationItem } from 'utils';
import { AlternateDiagnosesInput, PrimaryDiagnosisInput } from './IcdDiagnosisInputs';
import { APPROVED_PATIENT_EDUCATION_QUERY_KEY } from './PatientEducationAdminPage';
import { Icd10Option } from './useIcd10SearchInput';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  item: ApprovedPatientEducationItem;
};

export const EditApprovedPatientEducationCodesDialog: FC<DialogProps> = ({ open, onClose, item }) => {
  const apiClient = useOystehrAPIClient();
  const queryClient = useQueryClient();

  const initialPrimary = item.icdCodes[0] ?? null;
  const initialAlternates = item.icdCodes.slice(1);

  const [primary, setPrimary] = useState<Icd10Option | null>(
    initialPrimary ? { code: initialPrimary.code, display: initialPrimary.display } : null
  );
  const [alternates, setAlternates] = useState<Icd10Option[]>(
    initialAlternates.map((c) => ({ code: c.code, display: c.display }))
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
  const primaryErrorMessage = submitAttempted && !primary ? 'This field is required' : undefined;

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
          <PrimaryDiagnosisInput value={primary} onChange={setPrimary} required errorMessage={primaryErrorMessage} />
          <AlternateDiagnosesInput value={alternates} onChange={setAlternates} primary={primary} />
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
