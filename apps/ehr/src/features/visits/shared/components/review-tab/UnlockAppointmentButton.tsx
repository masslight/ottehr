import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAppointmentData } from '../../stores/appointment/appointment.store';

type UnlockAppointmentButtonProps = {
  onUnlocked?: () => void;
};

export const UnlockAppointmentButton: FC<UnlockAppointmentButtonProps> = ({ onUnlocked }) => {
  const { appointment, encounter, appointmentRefetch } = useAppointmentData();
  const { isAppointmentReadOnly, visitType } = useGetAppointmentAccessibility();
  const apiClient = useOystehrAPIClient();
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const isFollowup = visitType === 'follow-up';

  if (!isAppointmentReadOnly) {
    return null;
  }

  const handleUnlock = async (): Promise<void> => {
    try {
      setIsLoading(true);

      if (isFollowup ? !encounter?.id : !appointment?.id) {
        enqueueSnackbar(isFollowup ? 'Encounter ID not found.' : 'Appointment ID not found.', { variant: 'error' });
        return;
      }

      if (!apiClient) {
        enqueueSnackbar('API client not available.', { variant: 'error' });
        return;
      }

      // Call the unlock-appointment zambda
      const response = await apiClient.unlockAppointment(
        isFollowup ? { encounterId: encounter.id } : { appointmentId: appointment!.id }
      );

      if (response.message) {
        enqueueSnackbar(response.message, { variant: 'success' });

        // Refresh appointment data to reflect the unlocked state
        await appointmentRefetch();

        // Call the onUnlocked callback if provided
        onUnlocked?.();
      }
    } catch (error: any) {
      console.error('Error unlocking appointment:', error);
      enqueueSnackbar('Failed to unlock appointment. Please try again.', {
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <RoundedButton
        disabled={isLoading}
        onClick={() => setDialogOpen(true)}
        variant="contained"
        data-testid={dataTestIds.progressNotePage.unlockAppointmentButton}
      >
        Unlock
      </RoundedButton>
      <AppDialog
        variant="confirm"
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Unlock Appointment"
        primary={{
          label: 'Unlock',
          // Closes once the attempt has settled, as before; handleUnlock reports its own errors.
          onClick: async () => {
            await handleUnlock();
            setDialogOpen(false);
          },
          loading: isLoading,
        }}
      >
        Many organizations require notes to be signed and locked within 24-72 hours. If you are unlocking outside this
        time frame, consider first discussing with your organization.
      </AppDialog>
    </>
  );
};
