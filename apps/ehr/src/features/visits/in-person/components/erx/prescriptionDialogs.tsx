import { Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';

export const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : 'An error occurred.';

/** The prescriptions a dialog acts on: each one's name, directions, pharmacy and when it was sent. */
export const PrescriptionSummaryList: FC<{ prescriptions: PrescribedMedicationDTO[] }> = ({ prescriptions }) => {
  const userTimezone = DateTime.local().zoneName;
  return (
    <>
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
    </>
  );
};

interface SendEachProps {
  prescriptions: PrescribedMedicationDTO[];
  onClose: () => void;
  onSent: () => Promise<unknown>;
}

/** A dialog that sends something for each prescription in turn. `run` checks there's a provider, sends each (one
 * that fails doesn't stop the others) and says how it went. The dialog can't be closed while sending, and stays,
 * still sending, until `onSent`'s refetch lands: until then the rows still read as they were, and could be sent
 * again. */
export const useSendEach = ({
  prescriptions,
  onClose,
  onSent,
}: SendEachProps): {
  sending: boolean;
  close: () => void;
  run: (
    // Undefined when it went, else what went wrong, naming the prescription.
    sendOne: (prescription: PrescribedMedicationDTO, practitionerId: string) => Promise<string | undefined>,
    say: { done: (sent: number) => string; partly: (sent: number, total: number) => string }
  ) => Promise<void>;
} => {
  const user = useEvolveUser();
  const [sending, setSending] = useState(false);
  const run: ReturnType<typeof useSendEach>['run'] = async (sendOne, say) => {
    const practitionerId = user?.profileResource?.id;
    if (!practitionerId) {
      enqueueSnackbar('The provider could not be determined. Please reload and try again.', { variant: 'error' });
      return;
    }
    setSending(true);
    const failures: string[] = [];
    for (const prescription of prescriptions) {
      const failure = await sendOne(prescription, practitionerId);
      if (failure) failures.push(failure);
    }
    const sent = prescriptions.length - failures.length;
    if (failures.length === 0) {
      enqueueSnackbar(say.done(sent), { variant: 'success' });
    } else {
      enqueueSnackbar(
        `${prescriptions.length > 1 ? `${say.partly(sent, prescriptions.length)} ` : ''}${failures.join('; ')}`,
        { variant: 'error' }
      );
    }
    try {
      await onSent();
    } finally {
      setSending(false);
      onClose();
    }
  };
  return { sending, close: sending ? () => undefined : onClose, run };
};
