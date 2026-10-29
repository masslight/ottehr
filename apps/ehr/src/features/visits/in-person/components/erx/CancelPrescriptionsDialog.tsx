import { MenuItem, Stack, TextField, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { CANCEL_PRESCRIPTION_REASONS, CancelPrescriptionReason } from 'utils/lib/types/api/order-prescription.types';
import { useCancelPrescription } from '../../../shared/hooks/useCancelPrescription';
import { errorMessage, PrescriptionSummaryList, useSendEach } from './prescriptionDialogs';

interface CancelPrescriptionsDialogProps {
  prescriptions: PrescribedMedicationDTO[];
  onClose: () => void;
  onSent: () => Promise<unknown>;
}

export const CancelPrescriptionsDialog: FC<CancelPrescriptionsDialogProps> = ({ prescriptions, onClose, onSent }) => {
  const { mutateAsync: cancelPrescription } = useCancelPrescription();
  const [reason, setReason] = useState<CancelPrescriptionReason | ''>('');
  const { sending, close, run } = useSendEach({ prescriptions, onClose, onSent });
  const several = prescriptions.length > 1;

  // The cancel endpoint takes one prescription, so each is sent in turn; one that fails doesn't stop the others.
  const send = async (): Promise<void> => {
    if (!reason) return;
    await run(
      async (prescription, practitionerId) => {
        try {
          await cancelPrescription({ medicationRequestId: prescription.resourceId!, practitionerId, reason });
          return undefined;
        } catch (error) {
          console.error(`Error canceling prescription: ${error}`);
          return `${prescription.name}: ${errorMessage(error)}`;
        }
      },
      {
        done: (sent) => (sent === 1 ? 'Cancellation sent' : `${sent} cancellations sent`),
        partly: (sent, total) => `${sent} of ${total} cancellations sent.`,
      }
    );
  };

  return (
    <CustomDialog
      open
      handleClose={close}
      title={several ? `Cancel ${prescriptions.length} prescriptions` : 'Cancel prescription'}
      description={
        <Stack spacing={2} sx={{ pt: 1 }}>
          <PrescriptionSummaryList prescriptions={prescriptions} />
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
