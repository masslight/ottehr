import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter } from 'fhir/r4b';
import {
  getCriticalUpdateTagOp,
  getEncounterStatusHistoryUpdateOp,
  getPatchBinary,
  User,
  visitStatusToFhirAppointmentStatusMap,
  visitStatusToFhirEncounterStatusMap,
  VisitStatusWithoutUnknown,
} from 'utils';

export const changeInPersonVisitStatusIfPossible = async (
  encounter: Encounter,
  appointment: Appointment,
  oystehr: Oystehr,
  user: User,
  updatedStatus: VisitStatusWithoutUnknown
): Promise<void> => {
  const encounterPatchOp: Operation[] = [];
  const appointmentPatchOp: Operation[] = [];

  const updateInPersonVisitStatusOp = await getUpdateInPersonVisitStatusOperation(
    encounter,
    appointment,
    oystehr,
    user,
    updatedStatus
  );
  if (updateInPersonVisitStatusOp) {
    encounterPatchOp.push(...updateInPersonVisitStatusOp);
    appointmentPatchOp.push(...updateInPersonVisitStatusOp);
  }

  if (encounterPatchOp.length > 0) {
    await oystehr.fhir.transaction({
      requests: [
        getPatchBinary({
          resourceType: 'Encounter',
          resourceId: encounter.id!,
          patchOperations: encounterPatchOp,
        }),
      ],
    });
  }

  if (appointmentPatchOp.length > 0) {
    await oystehr.fhir.transaction({
      requests: [
        getPatchBinary({
          resourceType: 'Appointment',
          resourceId: appointment.id!,
          patchOperations: appointmentPatchOp,
        }),
      ],
    });
  }
};

const getUpdateInPersonVisitStatusOperation = async (
  encounter: Encounter,
  appointment: Appointment,
  oystehr: Oystehr,
  user: User,
  updatedStatus: VisitStatusWithoutUnknown
): Promise<Operation[] | void> => {
  if (!user) {
    throw new Error('User is not defined');
  }
  if (!appointment || !appointment.id) {
    throw new Error('Appointment is not defined');
  }
  if (!encounter || !encounter.id) {
    throw new Error('Encounter is not defined');
  }
  if (!oystehr) {
    throw new Error('Oystehr is not defined');
  }
  const appointmentStatus = visitStatusToFhirAppointmentStatusMap[updatedStatus];
  const encounterStatus = visitStatusToFhirEncounterStatusMap[updatedStatus];

  const appointmentPatchOps: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: appointmentStatus,
    },
  ];

  if (appointment.status === 'cancelled') {
    appointmentPatchOps.push({
      op: 'remove',
      path: '/cancelationReason',
    });
  }

  const updateTag = getCriticalUpdateTagOp(appointment, `Staff ${user?.email ? user.email : `(${user?.id})`}`);
  appointmentPatchOps.push(updateTag);

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
    resourceId: appointment.id,
    patchOperations: appointmentPatchOps,
  });
  const encounterPatch = getPatchBinary({
    resourceType: 'Encounter',
    resourceId: encounter.id,
    patchOperations: encounterPatchOps,
  });
  await oystehr.fhir.transaction({
    requests: [appointmentPatch, encounterPatch],
  });
};
