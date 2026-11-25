import { Alert, Box, Typography } from '@mui/material';
import { DesktopDatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { FC, useEffect, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { MedicalRecordDateRange, MedicalRecordDateSpan } from 'utils/lib/types/data/get-patient-medical-record.types';

interface MedicalRecordDateRangeDialogProps {
  open: boolean;
  confirmText: string;
  recordDates?: MedicalRecordDateSpan;
  loading: boolean;
  loadFailed: boolean;
  onClose: () => void;
  onConfirm: (dateRange: MedicalRecordDateRange) => Promise<void>;
}

export const MedicalRecordDateRangeDialog: FC<MedicalRecordDateRangeDialogProps> = ({
  open,
  confirmText,
  recordDates,
  loading,
  loadFailed,
  onClose,
  onConfirm,
}) => {
  const [from, setFrom] = useState<DateTime | null>(null);
  const [to, setTo] = useState<DateTime | null>(null);
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!open) {
      setInitialized(false);
      return;
    }
    if (initialized) return;
    setMessage(undefined);
    if (loading || loadFailed || !recordDates) {
      setFrom(null);
      setTo(null);
      return;
    }
    const today = DateTime.now().startOf('day');
    const latestDay = recordDates.latest ? DateTime.fromISO(recordDates.latest).startOf('day') : today;
    setFrom(recordDates.earliest ? DateTime.fromISO(recordDates.earliest).startOf('day') : today);
    setTo(latestDay > today ? latestDay : today);
    setInitialized(true);
  }, [open, initialized, loading, loadFailed, recordDates]);

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
      disabled={!initialized}
      slotProps={{ textField: { fullWidth: true, inputProps: { 'data-testid': testId } } }}
    />
  );

  return (
    <AppDialog
      variant="form"
      size="s"
      open={open}
      onClose={onClose}
      title="Medical Record"
      data-testid={dataTestIds.medicalRecordDateRangeDialog.root}
      primary={{
        label: confirmText,
        onClick: () => void confirm(),
        // Not loading while the record dates load: the shell would then also block closing.
        loading: submitting,
        disabled: !initialized || !isValid,
        'data-testid': dataTestIds.medicalRecordDateRangeDialog.confirmButton,
      }}
    >
      <Typography variant="body1">Dates predefined to include all available records.</Typography>
      <LocalizationProvider dateAdapter={AdapterLuxon}>
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          {datePicker('From', from, setFrom, dataTestIds.medicalRecordDateRangeDialog.fromInput)}
          {datePicker('To', to, setTo, dataTestIds.medicalRecordDateRangeDialog.toInput)}
        </Box>
      </LocalizationProvider>
      {!initialized && loadFailed && !loading && (
        <Alert severity="error" sx={{ mt: 2 }} data-testid={dataTestIds.medicalRecordDateRangeDialog.loadError}>
          Couldn't load the record dates. Close the dialog and try again.
        </Alert>
      )}
      {message && (
        <Alert severity="warning" sx={{ mt: 2 }} data-testid={dataTestIds.medicalRecordDateRangeDialog.message}>
          {message}
        </Alert>
      )}
    </AppDialog>
  );
};
