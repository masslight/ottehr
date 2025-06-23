import Oystehr from '@oystehr/sdk';
import { Coding, Encounter } from 'fhir/r4b';
import { useMutation } from 'react-query';
import { assignPractitioner, unassignPractitioner } from 'src/api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import useEvolveUser, { EvolveUser } from '../../../hooks/useEvolveUser';

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

const handleParticipantPeriod = async (
  oystehrZambda: Oystehr | undefined,
  encounter: Encounter | undefined,
  user: EvolveUser | undefined,
  action: 'start' | 'end',
  practitionerType: Coding[]
): Promise<void> => {
  if (!oystehrZambda || !encounter || !user || !user.profileResource?.id) {
    console.warn('Missing required data:', { oystehrZambda, encounter, user, profileResource: user?.profileResource }); //
    return;
  }

  if (!encounter.id) {
    throw new Error('Encounter ID is required');
  }

  try {
    if (action === 'start') {
      await assignPractitioner(oystehrZambda, {
        encounterId: encounter.id,
        practitioner: user.profileResource,
        userRole: practitionerType,
      });
    } else {
      await unassignPractitioner(oystehrZambda, {
        encounterId: encounter.id,
        practitioner: user.profileResource,
        userRole: practitionerType,
      });
    }
  } catch (error) {
    throw new Error(`Failed to ${action} practitioner: ${error}`);
  }
};
