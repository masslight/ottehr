import { Operation } from 'fast-json-patch';
import { DateTime } from 'luxon';
import { AppointmentPackage } from './types';

/**
 * This functions handles empty encounter status history and always guarantees that
 * there is at least one status history record with current status
 */
export const handleEmptyEncounterStatusHistoryOp = (appointmentPackage: AppointmentPackage): Operation[] => {
  const patchOperations = [];
  const now = DateTime.utc().toISO()!;
  const statusHistoryLength = appointmentPackage.encounter.statusHistory?.length || 0;
  if (statusHistoryLength <= 0) {
    patchOperations.push(addStatusHistoryOp());
    patchOperations.push(addStatusHistoryRecordOp(0, appointmentPackage.encounter.status, now));
  }
  return patchOperations;
};

export const changeStatusOp = (newStatus: string): Operation => {
  return {
    op: 'replace',
    path: '/status',
    value: newStatus,
  };
};

export const addStatusHistoryOp = (): Operation => {
  return {
    op: 'add',
    path: `/statusHistory`,
    value: [],
  };
};

export const addStatusHistoryRecordOp = (statusHistoryIndex: number, status: string, startTime: string): Operation => {
  return {
    op: 'add',
    path: `/statusHistory/${statusHistoryIndex}`,
    value: {
      status: status,
      period: {
        start: startTime,
      },
    },
  };
};

export const deleteStatusHistoryRecordOp = (statusHistoryIndex: number): Operation => {
  return {
    op: 'remove',
    path: `/statusHistory/${statusHistoryIndex}`,
  };
};

export const changeStatusRecordPeriodValueOp = (
  statusHistoryIndex: number,
  periodElement: 'start' | 'end',
  value: string,
): Operation => {
  return {
    op: 'add',
    path: `/statusHistory/${statusHistoryIndex}/period/${periodElement}`,
    value: value,
  };
};
