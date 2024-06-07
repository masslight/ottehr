import { EncounterStatusHistory } from 'fhir/r4';
import { mapStatusToTelemed, TelemedStatusHistoryElement } from '../types';

export const mapEncounterStatusHistory = (
  statusHistory: EncounterStatusHistory[],
  appointmentStatus: string
): TelemedStatusHistoryElement[] => {
  const result: TelemedStatusHistoryElement[] = [];

  statusHistory.forEach((statusElement) => {
    result.push({
      start: statusElement.period.start,
      end: statusElement.period.end,
      status: mapStatusToTelemed(statusElement.status, undefined),
    });
  });
  if (appointmentStatus === 'fulfilled' && result.at(-1)?.status === 'unsigned') {
    result.push({
      start: result.at(-1)?.end,
      status: 'complete',
    });
  }

  return result;
};
