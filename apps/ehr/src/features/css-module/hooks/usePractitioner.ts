import { useMutation } from 'react-query';
import { SelectChangeEvent } from '@mui/material';
import { useApiClients } from '../../../hooks/useAppClients';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { handleParticipantPeriod } from '../../../helpers/practitionerUtils';
import {
  getPatchBinary,
  getEncounterStatusHistoryUpdateOp,
  visitStatusToFhirAppointmentStatusMap,
  visitStatusToFhirEncounterStatusMap,
  VisitStatusLabel,
  VisitStatusWithoutUnknown,
} from 'utils';
import { Operation } from 'fast-json-patch';
import { Coding, Encounter } from 'fhir/r4b';

export const usePractitionerActions = (
  appointmentId: string | undefined,
  appointmentStatus: string | undefined,
  encounter: Encounter | undefined,
  action: 'start' | 'end',
  practitionerType: Coding[],
  updateStatus?: boolean,
  selectedStatus?: VisitStatusLabel
): { isEncounterUpdatePending: boolean; handleUpdatePractitionerAndStatus: () => Promise<void> } => {
  const { oystehr, oystehrZambda } = useApiClients();
  const user = useEvolveUser();

  // todo: updateStatusForAppointment logic will move to backend in another pr
  async function updateStatusForAppointment(event: SelectChangeEvent<VisitStatusLabel | unknown>): Promise<void> {
    try {
      if (!user) {
        throw new Error('User is not defined');
      }
      if (!appointmentId || !appointmentStatus) {
        throw new Error('Appointment is not defined');
      }
      if (!encounter || !encounter.id) {
        throw new Error('Encounter is not defined');
      }
      if (!oystehr) {
        throw new Error('Oystehr is not defined');
      }

      const updatedStatus = event.target.value as VisitStatusWithoutUnknown;
      const appointmentStatusMapped = visitStatusToFhirAppointmentStatusMap[updatedStatus];
      const encounterStatusMapped = visitStatusToFhirEncounterStatusMap[updatedStatus];

      const patchOps: Operation[] = [
        {
          op: 'replace',
          path: '/status',
          value: appointmentStatusMapped,
        },
      ];

      if (appointmentStatus === 'cancelled') {
        patchOps.push({
          op: 'remove',
          path: '/cancelationReason',
        });
      }

      const encounterPatchOps: Operation[] = [
        {
          op: 'replace',
          path: '/status',
          value: encounterStatusMapped,
        },
      ];

      const encounterStatusHistoryUpdate: Operation = getEncounterStatusHistoryUpdateOp(
        encounter,
        encounterStatusMapped
      );
      encounterPatchOps.push(encounterStatusHistoryUpdate);

      const appointmentPatch = getPatchBinary({
        resourceType: 'Appointment',
        resourceId: appointmentId,
        patchOperations: patchOps,
      });
      const encounterPatch = getPatchBinary({
        resourceType: 'Encounter',
        resourceId: encounter.id,
        patchOperations: encounterPatchOps,
      });
      await oystehr.fhir.transaction({
        requests: [appointmentPatch, encounterPatch],
      });
    } catch (error) {
      throw new Error(JSON.stringify(error));
    }
  }

  const mutation = useMutation(async () => {
    try {
      await handleParticipantPeriod(oystehrZambda, encounter, user, action, practitionerType);

      if (updateStatus) {
        await updateStatusForAppointment({ target: { value: selectedStatus } } as SelectChangeEvent);
      }
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

  return {
    isEncounterUpdatePending: mutation.isLoading,
    handleUpdatePractitionerAndStatus: mutation.mutateAsync,
  };
};
