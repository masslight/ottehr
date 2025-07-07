import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter } from 'fhir/r4b';
import {
  getEncounterStatusHistoryUpdateOp,
  getPatchBinary,
  User,
  visitStatusToFhirAppointmentStatusMap,
  visitStatusToFhirEncounterStatusMap,
  VisitStatusWithoutUnknown,
} from 'utils';
import { EncounterPackage } from '../../../shared/practitioner/types';

export const changeInPersonVisitStatusIfPossible = async (
  oystehr: Oystehr,
  resourcesToUpdate: EncounterPackage,
  user: User,
  updatedStatus: VisitStatusWithoutUnknown
): Promise<void> => {
  if (!resourcesToUpdate.encounter?.id || !resourcesToUpdate.appointment?.id) {
    throw new Error('Invalid Encounter or Appointment ID');
  }

  const updateInPersonAppointmentStatusOp = await getUpdateInPersonAppointmentStatusOperation(
    resourcesToUpdate.appointment,
    oystehr,
    user,
    updatedStatus
  );

  const updateInPersonEncounterStatusOp = await getUpdateInPersonEncounterStatusOperation(
    resourcesToUpdate.encounter,
    oystehr,
    user,
    updatedStatus
  );

  console.log('Appointment Patch Ops:', updateInPersonAppointmentStatusOp);
  console.log('Encounter Patch Ops:', updateInPersonEncounterStatusOp);

  if (updateInPersonAppointmentStatusOp.length > 0 || updateInPersonEncounterStatusOp.length > 0) {
    const requests = [
      ...(updateInPersonEncounterStatusOp.length > 0
        ? [
            getPatchBinary({
              resourceType: 'Encounter',
              resourceId: resourcesToUpdate.encounter.id!,
              patchOperations: updateInPersonEncounterStatusOp,
            }),
          ]
        : []),
      ...(updateInPersonAppointmentStatusOp.length > 0
        ? [
            getPatchBinary({
              resourceType: 'Appointment',
              resourceId: resourcesToUpdate.appointment.id,
              patchOperations: updateInPersonAppointmentStatusOp,
            }),
          ]
        : []),
    ];

    try {
      await oystehr.fhir.transaction({
        requests,
      });
    } catch (error) {
      console.error('Error in transaction request:', error);
    }
  } else {
    console.log('No patch operations to perform');
  }
};

const getUpdateInPersonAppointmentStatusOperation = async (
  appointment: Appointment,
  oystehr: Oystehr,
  user: User,
  updatedStatus: VisitStatusWithoutUnknown
): Promise<Operation[]> => {
  if (!user || !appointment?.id || !oystehr) {
    throw new Error('Missing required data');
  }

  const appointmentStatus = visitStatusToFhirAppointmentStatusMap[updatedStatus];
  if (!appointmentStatus) {
    console.warn(`Unknown appointment status: ${updatedStatus}`);
    return [];
  }

  const appointmentPatchOps: Operation[] = [{ op: 'replace', path: '/status', value: appointmentStatus }];

  if (appointment.status === 'cancelled') {
    appointmentPatchOps.push({ op: 'remove', path: '/cancelationReason' });
  }

  return appointmentPatchOps;
};

const getUpdateInPersonEncounterStatusOperation = async (
  encounter: Encounter,
  oystehr: Oystehr,
  user: User,
  updatedStatus: VisitStatusWithoutUnknown
): Promise<Operation[]> => {
  if (!user || !encounter?.id || !oystehr) {
    throw new Error('Missing required data');
  }

  const encounterStatus = visitStatusToFhirEncounterStatusMap[updatedStatus];
  if (!encounterStatus) {
    console.warn(`Unknown encounter status: ${updatedStatus}`);
    return [];
  }

  const encounterPatchOps: Operation[] = [{ op: 'replace', path: '/status', value: encounterStatus }];

  if (updatedStatus === 'ready for discharge') {
    const attenderIndex = encounter.participant?.findIndex(
      (p) => p?.type?.some((t) => t?.coding?.some((coding) => coding.code === 'ATND'))
    );

    if (attenderIndex !== -1) {
      const now = new Date().toISOString();
      encounterPatchOps.push({
        op: 'add',
        path: `/participant/${attenderIndex}/period/end`,
        value: now,
      });
    }
  }

  const encounterStatusHistoryUpdate: Operation = getEncounterStatusHistoryUpdateOp(encounter, encounterStatus);
  encounterPatchOps.push(encounterStatusHistoryUpdate);

  return encounterPatchOps;
};
