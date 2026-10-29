import { Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useState } from 'react';
import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { PharmacySearchResult } from 'utils/lib/types/api/erx-search.types';
import { CancelPrescriptionReason } from 'utils/lib/types/api/order-prescription.types';
import { useCancelPrescription } from '../../../shared/hooks/useCancelPrescription';
import { useOrderPrescription } from '../../../shared/hooks/useOrderPrescription';
import { PharmacySearch } from './PharmacySearch';
import { errorMessage, PrescriptionSummaryList, useSendEach } from './prescriptionDialogs';
import { isPrescriptionCancellable, prescriptionToOrderForPharmacy } from './prescriptionStatus';

const CANCEL_REASON: CancelPrescriptionReason = 'Duplicate order (different pharmacy)';

const ALREADY_THERE = 'Already sent to this pharmacy';

/** Whether the prescription was sent to this pharmacy, by its NCPDP ID. */
const isAt = (prescription: PrescribedMedicationDTO, pharmacy: PharmacySearchResult): boolean =>
  !!prescription.pharmacyId && prescription.pharmacyId === pharmacy.ncpdpId;

interface SendToAnotherPharmacyDialogProps {
  prescriptions: PrescribedMedicationDTO[];
  onClose: () => void;
  onSent: () => Promise<unknown>;
}

export const SendToAnotherPharmacyDialog: FC<SendToAnotherPharmacyDialogProps> = ({
  prescriptions,
  onClose,
  onSent,
}) => {
  const { mutateAsync: cancelPrescription } = useCancelPrescription();
  const { mutateAsync: orderPrescription } = useOrderPrescription();
  const [pharmacy, setPharmacy] = useState<PharmacySearchResult | null>(null);
  const { sending, close, run } = useSendEach({ prescriptions, onClose, onSent });
  const several = prescriptions.length > 1;
  // Of several, those already at the pharmacy picked are left as they are; it can't be picked for one, or for all.
  const alreadyThere = pharmacy ? prescriptions.filter((prescription) => isAt(prescription, pharmacy)) : [];

  // Each prescription in turn: a sent one is cancelled first, and the new one goes out without waiting for the
  // pharmacy to confirm; a cancellation that fails sends nothing, so the patient never has two. An errored one only
  // goes out again. One that fails doesn't stop the others.
  const send = async (): Promise<void> => {
    if (!pharmacy) return;
    // A prescription is always written today.
    const writtenDate = DateTime.local().toISODate() ?? '';
    await run(
      async (prescription, practitionerId) => {
        if (isAt(prescription, pharmacy))
          return `${prescription.name}: already sent to ${pharmacy.name}; nothing was sent`;
        const order = prescriptionToOrderForPharmacy(prescription, { practitionerId, pharmacy, writtenDate });
        if (!order) return `${prescription.name}: its order is incomplete; nothing was sent`;
        const cancelling = isPrescriptionCancellable(prescription);
        if (cancelling) {
          try {
            await cancelPrescription({
              medicationRequestId: prescription.resourceId!,
              practitionerId,
              reason: CANCEL_REASON,
            });
          } catch (error) {
            console.error(`Error canceling prescription: ${error}`);
            return `${prescription.name}: cancellation failed (${errorMessage(error)}); nothing was sent`;
          }
        }
        try {
          await orderPrescription(order);
          return undefined;
        } catch (error) {
          console.error(`Error ordering prescription: ${error}`);
          return `${prescription.name}: ${cancelling ? 'cancellation sent, but ' : ''}sending to ${
            pharmacy.name
          } failed (${errorMessage(error)})`;
        }
      },
      {
        done: (sent) =>
          sent === 1 ? `Prescription sent to ${pharmacy.name}` : `${sent} prescriptions sent to ${pharmacy.name}`,
        partly: (sent, total) => `${sent} of ${total} sent to ${pharmacy.name}.`,
      }
    );
  };

  return (
    <CustomDialog
      open
      handleClose={close}
      title={several ? `Send ${prescriptions.length} prescriptions to another pharmacy` : 'Send to another pharmacy'}
      description={
        <Stack spacing={2} sx={{ pt: 1 }}>
          <PrescriptionSummaryList prescriptions={prescriptions} />
          <PharmacySearch
            onPick={setPharmacy}
            unavailable={(option) =>
              prescriptions.every((prescription) => isAt(prescription, option)) ? ALREADY_THERE : undefined
            }
          />
          {pharmacy && (
            <Typography variant="body2">
              Send to {pharmacy.name},{' '}
              <Typography component="span" variant="body2" color="text.secondary">
                {pharmacy.address} · {pharmacy.phone}
              </Typography>
            </Typography>
          )}
          {alreadyThere.length > 0 && (
            <Typography variant="body2" color="warning.dark">
              {ALREADY_THERE}, so left as is: {alreadyThere.map((prescription) => prescription.name).join(', ')}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            A sent prescription is cancelled at its pharmacy ({CANCEL_REASON}) and sent again unchanged.
          </Typography>
        </Stack>
      }
      closeButtonText={several ? 'Keep prescriptions' : 'Keep prescription'}
      handleConfirm={send}
      confirmText="Send to pharmacy"
      confirmLoading={sending}
      disabled={!pharmacy}
      fullWidth
      maxWidth="sm"
    />
  );
};
