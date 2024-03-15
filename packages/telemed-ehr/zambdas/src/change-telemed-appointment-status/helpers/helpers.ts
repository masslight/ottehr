import { BatchInputRequest, FhirClient } from '@zapehr/sdk';
import { TelemedCallStatuses } from 'ehr-utils';
import { AppointmentPackage } from './types';
import {
  addStatusHistoryRecordOp,
  changeStatusOp,
  changeStatusRecordPeriodValueOp,
  deleteStatusHistoryRecordOp,
  handleEmptyEncounterStatusHistoryOp,
} from './fhir-res-patch-operations';
import { getPatchBinary } from '../../../../app/src/helpers/fhir';
import { Operation } from 'fast-json-patch';
import { telemedStatusToEncounter } from '../../shared/appointment/helpers';
import { DateTime } from 'luxon';
import { EncounterStatusHistory } from 'fhir/r4';

export const changeStatusIfPossible = async (
  fhirClient: FhirClient,
  resourcesToUpdate: AppointmentPackage,
  currentStatus: TelemedCallStatuses,
  newStatus: TelemedCallStatuses,
): Promise<void> => {
  let appointmentPatchOp: Operation[] = [];
  let encounterPatchOp: Operation[] = [];

  switch (true) {
    case currentStatus === 'ready' && newStatus === 'pre-video':
      encounterPatchOp = defaultEncounterOperations(newStatus, resourcesToUpdate);
      break;
    case currentStatus === 'pre-video' && newStatus === 'ready':
      encounterPatchOp = defaultEncounterOperations(newStatus, resourcesToUpdate);
      break;
    case currentStatus === 'on-video' && newStatus === 'unsigned':
      encounterPatchOp = defaultEncounterOperations(newStatus, resourcesToUpdate);
      break;
    case currentStatus === 'unsigned' && newStatus === 'complete':
      encounterPatchOp = encounterOperationsWrapper(
        newStatus,
        resourcesToUpdate,
        (_newEncounterStatus, statusHistoryLength) => {
          const statusHistory = resourcesToUpdate.encounter.statusHistory || [];
          if (
            statusHistoryLength >= 2 &&
            statusHistory[statusHistoryLength - 1].status === 'finished' &&
            statusHistory[statusHistoryLength - 2].status === 'finished'
          ) {
            return mergeUnsignedStatusesTimesOp(statusHistory);
          } else {
            return [changeStatusRecordPeriodValueOp(statusHistoryLength - 1, 'end', now())];
          }
        },
      );
      appointmentPatchOp = [changeStatusOp('fulfilled')];
      break;
    case currentStatus === 'complete' && newStatus === 'unsigned':
      encounterPatchOp = encounterOperationsWrapper(
        newStatus,
        resourcesToUpdate,
        (newEncounterStatus, statusHistoryLength) => {
          return [
            addStatusHistoryRecordOp(statusHistoryLength, newEncounterStatus, now()),
            changeStatusOp(newEncounterStatus),
          ];
        },
      );
      appointmentPatchOp = [changeStatusOp('arrived')];
      break;
    default:
      throw new Error(
        `Status change between current status: '${currentStatus}', and desired status: '${newStatus}', is not possible.`,
      );
  }
  const patchOperationsBinaries: BatchInputRequest[] = [];

  if (resourcesToUpdate.appointment.id && appointmentPatchOp.length > 0) {
    patchOperationsBinaries.push(
      getPatchBinary({
        resourceType: 'Appointment',
        resourceId: resourcesToUpdate.appointment.id,
        patchOperations: appointmentPatchOp,
      }),
    );
  }
  patchOperationsBinaries.push(
    getPatchBinary({
      resourceType: 'Encounter',
      resourceId: resourcesToUpdate.encounter.id!,
      patchOperations: encounterPatchOp,
    }),
  );

  await fhirClient.transactionRequest({ requests: patchOperationsBinaries });
};

/**
 * handle complete status after appointment already was in complete status, so we
 * wanna summarize all time appointment was in unsigned status. For example:
 * unsigned - 3 min wait
 * complete - 5 min
 * unsigned - 9 min - practitioner decided to change something in and moved it to unsigned again.
 * So we wanna record 3 min initial + 9 min in unsigned to result record, because time in
 * complete status doesn't count
 */
const mergeUnsignedStatusesTimesOp = (statusHistory: EncounterStatusHistory[]): Operation[] => {
  let encounterOperations: Operation[] = [];
  let statusHistoryLength = statusHistory.length;
  const lastRecord = statusHistory[statusHistoryLength - 1];
  const beforeLastRecord = statusHistory[statusHistoryLength - 2];

  if (
    lastRecord.status === 'finished' &&
    beforeLastRecord.status === 'finished' &&
    lastRecord.period.start &&
    beforeLastRecord.period.start &&
    beforeLastRecord.period.end
  ) {
    const firstUnsignedStart = new Date(beforeLastRecord.period.start).getTime();
    const firstUnsignedEnd = new Date(beforeLastRecord.period.end).getTime();
    const secondUnsignedStart = new Date(lastRecord.period.start).getTime();
    const secondUnsignedEnd = new Date().getTime();

    const unisgnedTimeSummary =
      Math.abs(firstUnsignedEnd - firstUnsignedStart) + Math.abs(secondUnsignedEnd - secondUnsignedStart);
    const unsignedSummaryStart = new Date(Math.abs(new Date().getTime() - unisgnedTimeSummary)).toISOString();
    const unsignedSummaryEnd = now();

    encounterOperations.push(deleteStatusHistoryRecordOp(statusHistoryLength - 1));
    statusHistoryLength--;
    encounterOperations = encounterOperations.concat([
      changeStatusRecordPeriodValueOp(statusHistoryLength - 1, 'start', unsignedSummaryStart),
      changeStatusRecordPeriodValueOp(statusHistoryLength - 1, 'end', unsignedSummaryEnd),
    ]);
  }

  return encounterOperations;
};

const defaultEncounterOperations = (
  newTelemedStatus: TelemedCallStatuses,
  resourcesToUpdate: AppointmentPackage,
): Operation[] => {
  return encounterOperationsWrapper(newTelemedStatus, resourcesToUpdate, (newEncounterStatus, statusHistoryLength) => {
    return [
      changeStatusRecordPeriodValueOp(statusHistoryLength - 1, 'end', now()),
      addStatusHistoryRecordOp(statusHistoryLength, newEncounterStatus, now()),
      changeStatusOp(newEncounterStatus),
    ];
  });
};

const encounterOperationsWrapper = (
  newTelemedStatus: TelemedCallStatuses,
  resourcesToUpdate: AppointmentPackage,
  callback: (newEncounterStatus: string, statusHistoryLength: number) => Operation[],
): Operation[] => {
  const newEncounterStatus = telemedStatusToEncounter(newTelemedStatus);
  const statusHistoryLength = resourcesToUpdate.encounter.statusHistory?.length || 1;

  return handleEmptyEncounterStatusHistoryOp(resourcesToUpdate).concat(
    callback(newEncounterStatus, statusHistoryLength),
  );
};

const now = (): string => {
  return DateTime.utc().toISO()!;
};
