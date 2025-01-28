import { useMutation } from 'react-query';
import { SelectChangeEvent } from '@mui/material';
import { useApiClients } from '../../../hooks/useAppClients';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { useAppointment } from '../hooks/useAppointment';
import { handleParticipantPeriod } from '../../../helpers/practitionerUtils';
import {
  getPatchBinary,
  getCriticalUpdateTagOp,
  getEncounterStatusHistoryUpdateOp,
  visitStatusToFhirAppointmentStatusMap,
  visitStatusToFhirEncounterStatusMap,
  VisitStatusLabel,
  VisitStatusWithoutUnknown,
} from 'utils';
import { Operation } from 'fast-json-patch';
import { Coding } from 'fhir/r4b';

export const usePractitionerActions = (
  appointmentID: string,
  action: 'start' | 'end',
  practitionerType: Coding[],
  updateStatus?: boolean,
  selectedStatus?: VisitStatusLabel
): { isPractitionerLoading: boolean; handleUpdatePractitionerAndStatus: () => Promise<void> } => {
  const { oystehr, oystehrZambda } = useApiClients();
  const user = useEvolveUser();
  const { telemedData, refetch } = useAppointment(appointmentID);
  const { appointment, encounter } = telemedData;

  // todo: updateStatusForAppointment logic will move to backend in another pr
  async function updateStatusForAppointment(event: SelectChangeEvent<VisitStatusLabel | unknown>): Promise<void> {
    try {
      if (!user) {
        throw new Error('User is not defined');
      }
      if (!appointment || !appointmentID) {
        throw new Error('Appointment is not defined');
      }
      if (!encounter || !encounter.id) {
        throw new Error('Encounter is not defined');
      }
      if (!oystehr) {
        throw new Error('Oystehr is not defined');
      }

      const updatedStatus = event.target.value as VisitStatusWithoutUnknown;
      const appointmentStatus = visitStatusToFhirAppointmentStatusMap[updatedStatus];
      const encounterStatus = visitStatusToFhirEncounterStatusMap[updatedStatus];

      const patchOps: Operation[] = [
        {
          op: 'replace',
          path: '/status',
          value: appointmentStatus,
        },
      ];

      if (appointment.status === 'cancelled') {
        patchOps.push({
          op: 'remove',
          path: '/cancelationReason',
        });
      }

      const updateTag = getCriticalUpdateTagOp(appointment, `Staff ${user?.email ? user.email : `(${user?.id})`}`);
      patchOps.push(updateTag);

      const encounterPatchOps: Operation[] = [
        {
          op: 'replace',
          path: '/status',
          value: encounterStatus,
        },
      ];

      const encounterStatusHistoryUpdate: Operation = getEncounterStatusHistoryUpdateOp(encounter, encounterStatus);
      encounterPatchOps.push(encounterStatusHistoryUpdate);

      const appointmentPatch = getPatchBinary({
        resourceType: 'Appointment',
        resourceId: appointmentID,
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
      await refetch();
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
    isPractitionerLoading: mutation.isLoading,
    handleUpdatePractitionerAndStatus: mutation.mutateAsync,
  };
};
