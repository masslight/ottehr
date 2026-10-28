import { MenuItem, Stack, TextField, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { CANCEL_PRESCRIPTION_REASONS, CancelPrescriptionReason } from 'utils/lib/types/api/order-prescription.types';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { useCancelPrescription } from '../../../shared/hooks/useCancelPrescription';

interface CancelPrescriptionsDialogProps {
  prescriptions: PrescribedMedicationDTO[];
  onClose: () => void;
  onSent: () => Promise<unknown>;
}

export const CancelPrescriptionsDialog: FC<CancelPrescriptionsDialogProps> = ({ prescriptions, onClose, onSent }) => {
  const user = useEvolveUser();
  const { mutateAsync: cancelPrescription } = useCancelPrescription();
  const [reason, setReason] = useState<CancelPrescriptionReason | ''>('');
  const [sending, setSending] = useState(false);
  const userTimezone = DateTime.local().zoneName;
  const several = prescriptions.length > 1;

  // The cancel endpoint takes one prescription, so each is sent in turn; one that fails doesn't stop the others.
  const send = async (): Promise<void> => {
    const practitionerId = user?.profileResource?.id;
    if (!reason) return;
    if (!practitionerId) {
      enqueueSnackbar('The provider could not be determined. Please reload and try again.', { variant: 'error' });
      return;
    }
    setSending(true);
    const failures: string[] = [];
    for (const prescription of prescriptions) {
      try {
        await cancelPrescription({ medicationRequestId: prescription.resourceId!, practitionerId, reason });
      } catch (error) {
        console.error(`Error canceling prescription: ${error}`);
        const message = error instanceof Error && error.message ? error.message : 'An error occurred.';
        failures.push(`${prescription.name}: ${message}`);
      }
    }
    const sent = prescriptions.length - failures.length;
    if (failures.length === 0) {
      enqueueSnackbar(sent === 1 ? 'Cancellation sent' : `${sent} cancellations sent`, { variant: 'success' });
    } else {
      enqueueSnackbar(
        `${several ? `${sent} of ${prescriptions.length} cancellations sent. ` : ''}${failures.join('; ')}`,
        { variant: 'error' }
      );
    }
    setSending(false);
    onClose();
    await onSent();
  };

  return (
    <CustomDialog
      open
      handleClose={onClose}
      title={several ? `Cancel ${prescriptions.length} prescriptions` : 'Cancel prescription'}
      description={
        <Stack spacing={2} sx={{ pt: 1 }}>
          {prescriptions.map((prescription) => {
            const sent = formatDateToMDYWithTime(prescription.sent, userTimezone);
            return (
              <Stack key={prescription.resourceId}>
                <Typography variant="body1" fontWeight={500}>
                  {prescription.name}
                </Typography>
                <Typography variant="body2">{prescription.instructions}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {[prescription.pharmacyName, sent && `Sent ${sent.date} ${sent.time}`].filter(Boolean).join(' · ')}
                </Typography>
              </Stack>
            );
          })}
          <TextField
            select
            required
            size="small"
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value as CancelPrescriptionReason)}
          >
            {CANCEL_PRESCRIPTION_REASONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary">
            The pharmacy confirms or refuses the cancellation. Until then the prescription stays active.
          </Typography>
        </Stack>
      }
      closeButtonText={several ? 'Keep prescriptions' : 'Keep prescription'}
      handleConfirm={send}
      confirmText="Send cancellation"
      confirmLoading={sending}
      disabled={!reason}
      fullWidth
      maxWidth="sm"
    />
  );
};
