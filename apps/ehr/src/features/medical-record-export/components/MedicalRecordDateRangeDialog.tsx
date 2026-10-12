import CloseIcon from '@mui/icons-material/Close';
import { LoadingButton } from '@mui/lab';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import { DesktopDatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { FC, useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { MedicalRecordDateRange } from 'utils/lib/types/data/get-patient-medical-record.types';

interface MedicalRecordDateRangeDialogProps {
  open: boolean;
  confirmText: string;
  defaultFrom: DateTime | null;
  onClose: () => void;
  onConfirm: (dateRange: MedicalRecordDateRange) => Promise<void>;
}

export const MedicalRecordDateRangeDialog: FC<MedicalRecordDateRangeDialogProps> = ({
  open,
  confirmText,
  defaultFrom,
  onClose,
  onConfirm,
}) => {
  const theme = useTheme();
  const [today, setToday] = useState(() => DateTime.now().startOf('day'));
  const [from, setFrom] = useState<DateTime | null>(defaultFrom);
  const [to, setTo] = useState<DateTime | null>(today);
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const now = DateTime.now().startOf('day');
    setToday(now);
    setFrom(defaultFrom);
    setTo(now);
    setMessage(undefined);
  }, [open, defaultFrom]);

  const isValid = !!from?.isValid && !!to?.isValid && from.startOf('day') <= to.startOf('day');
  const confirm = async (): Promise<void> => {
    if (!from?.isValid || !to?.isValid) return;

    setSubmitting(true);
    setMessage(undefined);

    try {
      await onConfirm({
        from: from.startOf('day').toISO()!,
        to: to.endOf('day').toISO()!,
      });
      onClose();
    } catch (error) {
      setMessage(
        getApiError({
          error,
          defaultError: 'The medical record could not be prepared. Please try again.',
        })
      );
    } finally {
      setSubmitting(false);
    }
  };

  const datePicker = (
    label: string,
    value: DateTime | null,
    onChange: (value: DateTime | null) => void,
    testId: string
  ): JSX.Element => (
    <DesktopDatePicker
      label={label}
      value={value}
      onChange={(next) => {
        onChange(next);
        setMessage(undefined);
      }}
      format="MM/dd/yyyy"
      slotProps={{ textField: { fullWidth: true, inputProps: { 'data-testid': testId } } }}
    />
  );

  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onClose()}
      maxWidth="sm"
      fullWidth
      data-testid={dataTestIds.medicalRecordDateRangeDialog.root}
    >
      <DialogTitle sx={{ color: theme.palette.primary.dark, fontWeight: 600, fontSize: '24px' }}>
        Medical Record
        <IconButton
          aria-label="Close"
          onClick={onClose}
          disabled={submitting}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body1">Dates predefined to include all available records.</Typography>
        <LocalizationProvider dateAdapter={AdapterLuxon}>
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            {datePicker('From', from, setFrom, dataTestIds.medicalRecordDateRangeDialog.fromInput)}
            {datePicker('To', to, setTo, dataTestIds.medicalRecordDateRangeDialog.toInput)}
          </Box>
        </LocalizationProvider>
        {message && (
          <Alert severity="warning" sx={{ mt: 2 }} data-testid={dataTestIds.medicalRecordDateRangeDialog.message}>
            {message}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={submitting}
          sx={{ borderRadius: '100px', textTransform: 'none', fontWeight: 500 }}
        >
          Cancel
        </Button>
        <LoadingButton
          variant="contained"
          loading={submitting}
          disabled={!isValid}
          onClick={() => void confirm()}
          sx={{ borderRadius: '100px', textTransform: 'none', fontWeight: 500 }}
          data-testid={dataTestIds.medicalRecordDateRangeDialog.confirmButton}
        >
          {confirmText}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
