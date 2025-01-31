import { useMutation } from 'react-query';
import { useApiClients } from '../../../hooks/useAppClients';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { handleParticipantPeriod } from '../../../helpers/practitionerUtils';
import { Coding, Encounter } from 'fhir/r4b';

export const usePractitionerActions = (
  encounter: Encounter | undefined,
  action: 'start' | 'end',
  practitionerType: Coding[]
): { isEncounterUpdatePending: boolean; handleUpdatePractitioner: () => Promise<void> } => {
  const { oystehrZambda } = useApiClients();
  const user = useEvolveUser();

  const mutation = useMutation(async () => {
    try {
      await handleParticipantPeriod(oystehrZambda, encounter, user, action, practitionerType);
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

  return {
    isEncounterUpdatePending: mutation.isLoading,
    handleUpdatePractitioner: mutation.mutateAsync,
  };
};
