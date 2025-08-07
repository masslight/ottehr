import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter } from 'fhir/r4b';
import {
  getAppointmentMetaTagOpForStatusUpdate,
  getEncounterStatusHistoryUpdateOp,
  getPatchBinary,
  PRACTITIONER_CODINGS,
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
    resourcesToUpdate.encounter,
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
      captureException(error, {
        tags: {
          encounterId: resourcesToUpdate.encounter.id,
          appointmentId: resourcesToUpdate.appointment.id,
          userId: user.id,
          function: 'changeInPersonVisitStatusIfPossible',
        },
        contexts: {
          extra: {
            updatedStatus,
          },
        },
      });
      console.error('Error in transaction request:', error);
      throw error;
    }
  } else {
    console.log('No patch operations to perform');
  }
};

const getUpdateInPersonAppointmentStatusOperation = async (
  appointment: Appointment,
  encounter: Encounter,
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

  let statusUpdatePatchValue = updatedStatus;
  if (updatedStatus === 'ready for provider') {
    const attenderParticipant = encounter.participant?.find(
      (p) => p?.type?.find((t) => t?.coding?.find((coding) => coding.code === 'ATND'))
    );
    // if the provider is already assigned then the visit is essentially skipping 'ready for provider' and being moved straight to provider
    // so the status update we want to record is for provider
    if (attenderParticipant) statusUpdatePatchValue = 'provider';
  }
  console.log('statusUpdatePatchValue', statusUpdatePatchValue);
  appointmentPatchOps.push(...getAppointmentMetaTagOpForStatusUpdate(appointment, statusUpdatePatchValue, { user }));

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

  if (updatedStatus === 'discharged') {
    const attenderIndex = encounter.participant?.findIndex(
      (p) => p?.type?.some((t) => t?.coding?.some((coding) => coding.code === PRACTITIONER_CODINGS.Attender[0].code))
    );

    if (attenderIndex !== undefined && attenderIndex >= 0) {
      const now = new Date().toISOString();
      const attenderPeriod = encounter.participant?.[attenderIndex]?.period;

      encounterPatchOps.push({
        op: 'add',
        path: `/participant/${attenderIndex}/period`,
        value: attenderPeriod ? { start: attenderPeriod.start, end: now } : { end: now },
      });
    }
  }

  // if the status is change to provider, we need to set the period start for the attender participant
  if (updatedStatus === 'provider') {
    const attenderIndex = encounter.participant?.findIndex(
      (p) => p?.type?.some((t) => t?.coding?.some((coding) => coding.code === PRACTITIONER_CODINGS.Attender[0].code))
    );
    if (attenderIndex !== undefined && attenderIndex >= 0) {
      const now = new Date().toISOString();
      const attenderPeriod = encounter.participant?.[attenderIndex]?.period;

      encounterPatchOps.push({
        op: 'add',
        path: `/participant/${attenderIndex}/period`,
        value: attenderPeriod?.start ? attenderPeriod : { start: now },
      });
    }
  }

  const encounterStatusHistoryUpdate: Operation = getEncounterStatusHistoryUpdateOp(encounter, encounterStatus);
  encounterPatchOps.push(encounterStatusHistoryUpdate);

  return encounterPatchOps;
};
