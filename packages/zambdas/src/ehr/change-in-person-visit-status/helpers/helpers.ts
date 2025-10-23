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

  console.log('Appointment Patch Ops:', JSON.stringify(updateInPersonAppointmentStatusOp, null, 2));
  console.log('Encounter Patch Ops:', JSON.stringify(updateInPersonEncounterStatusOp, null, 2));

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

/**
 * Periods are handled based on the status determination logic:
 *
 * const STATUS_DEFINITIONS = {
 *   PENDING: {
 *     appointmentStatus: 'booked',
 *     encounterStatus: 'planned',
 *     admParticipant: 'N/A',
 *     atndParticipant: 'N/A'
 *   },
 *   ARRIVED: {
 *     appointmentStatus: 'arrived',
 *     encounterStatus: 'arrived',
 *     admParticipant: 'N/A',
 *     atndParticipant: 'N/A'
 *   },
 *   READY: {
 *     appointmentStatus: 'checked-in',
 *     encounterStatus: 'arrived',
 *     admParticipant: 'N/A',
 *     atndParticipant: 'N/A'
 *   },
 *   INTAKE: {
 *     appointmentStatus: 'checked-in',
 *     encounterStatus: 'in-progress',
 *     admParticipant: '{start: T1} ← NO END!',
 *     atndParticipant: 'N/A'
 *   },
 *   READY_FOR_PROVIDER: {
 *     appointmentStatus: 'fulfilled',
 *     encounterStatus: 'in-progress',
 *     admParticipant: '{start: T1, end: T2} ← CLOSED',
 *     atndParticipant: 'N/A'
 *   },
 *   PROVIDER: {
 *     appointmentStatus: 'fulfilled',
 *     encounterStatus: 'in-progress',
 *     admParticipant: '{start: T1, end: T2}',
 *     atndParticipant: '{start: T3} ← NO END!'
 *   },
 *   DISCHARGED: {
 *     appointmentStatus: 'fulfilled',
 *     encounterStatus: 'in-progress',
 *     admParticipant: '{start: T1, end: T2}',
 *     atndParticipant: '{start: T3, end: T4} ← CLOSED'
 *   },
 *   COMPLETED: {
 *     appointmentStatus: 'fulfilled',
 *     encounterStatus: 'finished',
 *     admParticipant: '{start: T1, end: T2}',
 *     atndParticipant: '{start: T3, end: T4}'
 *   },
 *   CANCELLED: {
 *     appointmentStatus: 'cancelled',
 *     encounterStatus: 'cancelled',
 *     admParticipant: 'depends',
 *     atndParticipant: 'depends'
 *   },
 *   NO_SHOW: {
 *     appointmentStatus: 'noshow',
 *     encounterStatus: 'cancelled',
 *     admParticipant: 'N/A',
 *     atndParticipant: 'N/A'
 *   }
 * };
 */
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
  const dateNow = new Date().toISOString();

  if (
    updatedStatus === 'pending' ||
    updatedStatus === 'arrived' ||
    updatedStatus === 'ready' ||
    updatedStatus === 'cancelled' ||
    updatedStatus === 'no show'
  ) {
    updateAdmitterPeriod(encounterPatchOps, { encounter, deleteStartTime: true, deleteEndTime: true });
    updateAttenderPeriod(encounterPatchOps, { encounter, deleteStartTime: true, deleteEndTime: true });
  } else if (updatedStatus === 'intake') {
    updateAdmitterPeriod(encounterPatchOps, {
      encounter,
      startTime: dateNow,
      overrideStartTimeIfExists: true,
      deleteEndTime: true,
    });
    updateAttenderPeriod(encounterPatchOps, { encounter, deleteStartTime: true, deleteEndTime: true });
  } else if (updatedStatus === 'ready for provider') {
    updateAdmitterPeriod(encounterPatchOps, {
      encounter,
      startTime: dateNow,
      overrideStartTimeIfExists: false,
      endTime: dateNow,
      overrideEndTimeIfExists: true,
    });
    updateAttenderPeriod(encounterPatchOps, { encounter, deleteStartTime: true, deleteEndTime: true });
  } else if (updatedStatus === 'provider') {
    updateAdmitterPeriod(encounterPatchOps, {
      encounter,
      startTime: dateNow,
      overrideStartTimeIfExists: false,
      endTime: dateNow,
      overrideEndTimeIfExists: false,
    });
    updateAttenderPeriod(encounterPatchOps, {
      encounter,
      startTime: dateNow,
      overrideStartTimeIfExists: true,
      deleteEndTime: true,
    });
  } else if (
    updatedStatus === 'discharged' ||
    updatedStatus === 'awaiting supervisor approval' ||
    updatedStatus === 'completed'
  ) {
    updateAdmitterPeriod(encounterPatchOps, {
      encounter,
      startTime: dateNow,
      overrideStartTimeIfExists: false,
      endTime: dateNow,
      overrideEndTimeIfExists: false,
    });
    updateAttenderPeriod(encounterPatchOps, {
      encounter,
      startTime: dateNow,
      overrideStartTimeIfExists: false,
      endTime: dateNow,
      overrideEndTimeIfExists: true,
    });
  }

  const encounterStatusHistoryUpdate: Operation = getEncounterStatusHistoryUpdateOp(
    encounter,
    encounterStatus,
    updatedStatus
  );

  encounterPatchOps.push(encounterStatusHistoryUpdate);

  return encounterPatchOps;
};

const updateAdmitterPeriod = (
  operations: Operation[],
  {
    encounter,
    endTime,
    startTime,
    overrideEndTimeIfExists,
    overrideStartTimeIfExists,
    deleteEndTime,
    deleteStartTime,
  }: {
    encounter: Encounter;
    startTime?: string;
    endTime?: string;
    overrideEndTimeIfExists?: boolean;
    overrideStartTimeIfExists?: boolean;
    deleteEndTime?: boolean;
    deleteStartTime?: boolean;
  }
): void => {
  const participantIndex = findAdmitterIndex(encounter);

  if (participantIndex >= 0) {
    operations.push(
      ...updateParticipantPeriod({
        encounter,
        endTime,
        startTime,
        participantIndex,
        overrideEndTimeIfExists,
        overrideStartTimeIfExists,
        deleteEndTime,
        deleteStartTime,
      })
    );
  }
};

const updateAttenderPeriod = (
  operations: Operation[],
  {
    encounter,
    endTime,
    startTime,
    overrideEndTimeIfExists,
    overrideStartTimeIfExists,
    deleteEndTime,
    deleteStartTime,
  }: {
    encounter: Encounter;
    startTime?: string;
    endTime?: string;
    overrideEndTimeIfExists?: boolean;
    overrideStartTimeIfExists?: boolean;
    deleteEndTime?: boolean;
    deleteStartTime?: boolean;
  }
): void => {
  const participantIndex = findAttenderIndex(encounter);

  if (participantIndex >= 0) {
    operations.push(
      ...updateParticipantPeriod({
        encounter,
        endTime,
        startTime,
        participantIndex,
        overrideEndTimeIfExists,
        overrideStartTimeIfExists,
        deleteEndTime,
        deleteStartTime,
      })
    );
  }
};

const updateParticipantPeriod = ({
  encounter,
  endTime,
  startTime,
  deleteEndTime = false,
  deleteStartTime = false,
  overrideEndTimeIfExists = false,
  overrideStartTimeIfExists = false,
  participantIndex,
}: {
  encounter: Encounter;
  startTime?: string;
  endTime?: string;
  overrideEndTimeIfExists?: boolean;
  overrideStartTimeIfExists?: boolean;
  deleteEndTime?: boolean;
  deleteStartTime?: boolean;
  participantIndex: number;
}): Operation[] => {
  const participantPeriod = encounter.participant?.[participantIndex]?.period;

  const canUpdateStart = Boolean(startTime && (!participantPeriod?.start || overrideStartTimeIfExists));
  const canUpdateEnd = Boolean(endTime && (!participantPeriod?.end || overrideEndTimeIfExists));

  const canDeleteEnd = Boolean(deleteEndTime && participantPeriod?.end);
  const canDeleteStart = Boolean(deleteStartTime && participantPeriod?.start);

  if (!canUpdateStart && !canUpdateEnd && !canDeleteEnd && !canDeleteStart) {
    return [];
  }

  const updatedPeriod = { ...participantPeriod };

  if (canUpdateStart) {
    updatedPeriod.start = startTime;
  }

  if (canUpdateEnd) {
    updatedPeriod.end = endTime;
  }

  if (canDeleteEnd) {
    delete updatedPeriod.end;
  }

  if (canDeleteStart) {
    delete updatedPeriod.start;
  }

  if (Object.keys(updatedPeriod).length === 0) {
    return [
      {
        op: 'remove',
        path: `/participant/${participantIndex}/period`,
      },
    ];
  }

  return [
    {
      op: 'add',
      path: `/participant/${participantIndex}/period`,
      value: updatedPeriod,
    },
  ];
};

const findAdmitterIndex = (encounter: Encounter): number => {
  const index = encounter.participant?.findIndex(
    (p) => p?.type?.some((t) => t?.coding?.some((coding) => coding.code === PRACTITIONER_CODINGS.Admitter[0].code))
  );

  return typeof index === 'number' ? index : -1;
};

const findAttenderIndex = (encounter: Encounter): number => {
  const index = encounter.participant?.findIndex(
    (p) => p?.type?.some((t) => t?.coding?.some((coding) => coding.code === PRACTITIONER_CODINGS.Attender[0].code))
  );

  return typeof index === 'number' ? index : -1;
};
