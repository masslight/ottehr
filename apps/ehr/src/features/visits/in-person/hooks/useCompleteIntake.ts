import { enqueueSnackbar } from 'notistack';
import { handleChangeInPersonVisitStatus } from 'src/helpers/inPersonVisitStatusUtils';
import { useApiClients } from 'src/hooks/useAppClients';
import { getAdmitterPractitionerId, PRACTITIONER_CODINGS } from 'utils';
import { usePractitionerActions } from '../../shared/hooks/usePractitioner';
import { useAppointmentData } from '../../shared/stores/appointment/appointment.store';

interface UseCompleteIntakeResult {
  handleCompleteIntake: () => Promise<boolean>;
  isEncounterUpdatePending: boolean;
}

export const useCompleteIntake = (): UseCompleteIntakeResult => {
  const { oystehrZambda } = useApiClients();
  const { visitState, appointmentRefetch } = useAppointmentData();
  const { encounter } = visitState;

  const { isEncounterUpdatePending, handleUpdatePractitioner } = usePractitionerActions(
    encounter,
    'end',
    PRACTITIONER_CODINGS.Admitter
  );

  const assignedIntakePerformerId = encounter ? getAdmitterPractitionerId(encounter) : undefined;

  const handleCompleteIntake = async (): Promise<boolean> => {
    try {
      if (!assignedIntakePerformerId) {
        enqueueSnackbar('Please select intake practitioner first', { variant: 'error' });
        return false;
      }

      await handleUpdatePractitioner(assignedIntakePerformerId);
      await handleChangeInPersonVisitStatus(
        {
          encounterId: encounter!.id!,
          updatedStatus: 'ready for provider',
        },
        oystehrZambda
      );
      await appointmentRefetch();
      return true;
    } catch (error: any) {
      console.log(error.message);
      enqueueSnackbar('An error occurred trying to complete intake. Please try again.', { variant: 'error' });
      return false;
    }
  };

  return { handleCompleteIntake, isEncounterUpdatePending };
};
