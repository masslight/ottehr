import Oystehr from '@oystehr/sdk';
import { useMutation } from '@tanstack/react-query';
import { Coding, Encounter } from 'fhir/r4b';
import { assignPractitioner, unassignPractitioner } from 'src/api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { useAppointment } from './useAppointment';

export const usePractitionerActions = (
  encounter: Encounter | undefined,
  action: 'start' | 'end',
  practitionerType: Coding[]
): { isEncounterUpdatePending: boolean; handleUpdatePractitioner: (practitionerId: string) => Promise<void> } => {
  const { oystehrZambda } = useApiClients();
  const { refetch: refetchAppointment } = useAppointment(
    encounter?.appointment?.[0]?.reference?.replace('Appointment/', '')
  );

  const mutation = useMutation({
    mutationFn: async (practitionerId: string) => {
      try {
        await updateAssignment(oystehrZambda, encounter, practitionerId, action, practitionerType);
        await refetchAppointment();
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
  });

  return {
    isEncounterUpdatePending: mutation.isPending,
    handleUpdatePractitioner: mutation.mutateAsync,
  };
};

const updateAssignment = async (
  oystehrZambda: Oystehr | undefined,
  encounter: Encounter | undefined,
  practitionerId: string,
  action: 'start' | 'end',
  practitionerType: Coding[]
): Promise<void> => {
  if (!oystehrZambda || !encounter || !practitionerId) {
    console.warn('Missing required data:', { oystehrZambda, encounter, practitionerId });
    return;
  }

  if (!encounter.id) {
    throw new Error('Encounter ID is required');
  }

  try {
    if (action === 'start') {
      await assignPractitioner(oystehrZambda, {
        encounterId: encounter.id,
        practitionerId,
        userRole: practitionerType,
      });
    } else {
      await unassignPractitioner(oystehrZambda, {
        encounterId: encounter.id,
        practitionerId,
        userRole: practitionerType,
      });
    }
  } catch (error) {
    throw new Error(`Failed to ${action} practitioner: ${error}`);
  }
};
