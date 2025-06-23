import { NursingOrdersStatus } from './constants';
import { z } from 'zod';
import { Secrets } from '../../../secrets';

export type CreateNursingOrderParameters = {
  encounterId: string;
  notes: string;
};

export type UpdateNursingOrderParameters = {
  serviceRequestId: string;
  action: 'CANCEL ORDER' | 'COMPLETE ORDER';
};

export const NursingOrdersSearchBySchema = z.object({
  field: z.literal('serviceRequestId'),
  value: z.string(),
});

export type NursingOrdersSearchBy = z.infer<typeof NursingOrdersSearchBySchema>;

export interface GetNursingOrdersInput {
  encounterId: string;
  searchBy?: NursingOrdersSearchBy;
}

export interface GetNursingOrdersInputValidated extends GetNursingOrdersInput {
  secrets: Secrets | null;
}

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

export interface OrderToolTipConfig {
  icon: JSX.Element;
  title: string;
  tableUrl: string;
  orders: {
    serviceRequestId: string;
    testItemName: string;
    detailPageUrl: string;
    statusChip: JSX.Element;
  }[];
}
