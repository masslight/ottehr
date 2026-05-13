import { completeIntakeWorkflow } from 'src/helpers/completeIntakeWorkflow';
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
    return await completeIntakeWorkflow({
      assignedIntakePerformerId,
      encounterId: encounter!.id!,
      endIntakePractitioner: handleUpdatePractitioner,
      refetch: appointmentRefetch,
      zambdaClient: oystehrZambda,
    });
  };

  return { handleCompleteIntake, isEncounterUpdatePending };
};
