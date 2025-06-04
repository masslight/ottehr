import { NursingOrdersStatus } from './constants';

export type CreateNursingOrderParameters = {
  encounterId: string;
  notes: string;
};

export type UpdateNursingOrderParameters = {
  serviceRequestId: string;
  action: 'CANCEL ORDER' | 'COMPLETE ORDER';
};

export type NursingOrdersSearchBy = { field: 'serviceRequestId'; value: string };

export type GetNursingOrdersInput = {
  encounterId: string;
};

export interface NursingOrder {
  serviceRequestId: string;
  note: string;
  status: NursingOrdersStatus;
  orderAddedDate: string;
  orderingPhysician: string;
  encounterTimezone?: string;
}

export type NursingOrderDetailedDTO = NursingOrder & {
  history: NursingOrderHistoryRow[];
};

export type NursingOrderHistoryRow = {
  status: NursingOrdersStatus;
  performer: string;
  date: string;
};
