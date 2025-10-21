import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ConfirmationDialog } from '../../../../../components/ConfirmationDialog';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAppointmentData } from '../../stores/appointment/appointment.store';

type UnlockAppointmentButtonProps = {
  onUnlocked?: () => void;
};

export const UnlockAppointmentButton: FC<UnlockAppointmentButtonProps> = ({ onUnlocked }) => {
  const { appointment, appointmentRefetch } = useAppointmentData();
  const { isAppointmentLocked } = useGetAppointmentAccessibility();
  const apiClient = useOystehrAPIClient();
  const [isLoading, setIsLoading] = useState(false);

  if (!isAppointmentLocked) {
    return null;
  }

  const handleUnlock = async (): Promise<void> => {
    try {
      setIsLoading(true);

      if (!appointment?.id) {
        enqueueSnackbar('Appointment ID not found.', { variant: 'error' });
        return;
      }

      if (!apiClient) {
        enqueueSnackbar('API client not available.', { variant: 'error' });
        return;
      }

      // Call the unlock-appointment zambda
      const response = await apiClient.unlockAppointment({
        appointmentId: appointment.id,
      });

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
    <ConfirmationDialog
      title="Unlock Appointment"
      description="Many organizations require notes to be signed and locked within 24-72 hours. If you are unlocking outside this time frame, consider first discussing with your organization."
      response={handleUnlock}
      actionButtons={{
        proceed: { text: 'Unlock', loading: isLoading, color: 'error' },
        back: { text: 'Cancel' },
        reverse: true,
      }}
    >
      {(showDialog) => (
        <RoundedButton
          disabled={isLoading}
          onClick={showDialog}
          variant="contained"
          data-testid={dataTestIds.progressNotePage.unlockAppointmentButton}
        >
          Unlock
        </RoundedButton>
      )}
    </ConfirmationDialog>
  );
};
