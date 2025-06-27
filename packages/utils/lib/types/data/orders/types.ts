import { ExtendedMedicationDataForResponse } from '../../api';
import { InHouseOrderListPageItemDTO } from '../in-house';
import { LabOrderListPageDTO } from '../labs';
import { NursingOrdersStatus } from './constants';

export type CreateNursingOrderParameters = {
  encounterId: string;
  notes: string;
};

export type UpdateNursingOrderParameters = {
  serviceRequestId: string;
  action: 'CANCEL ORDER' | 'COMPLETE ORDER';
};

export type NursingOrdersSearchBy =
  | { field: 'encounterId'; value: string }
  | { field: 'encounterIds'; value: string[] }
  | { field: 'serviceRequestId'; value: string };

export type GetNursingOrdersInput = {
  searchBy: NursingOrdersSearchBy;
};

export interface NursingOrder {
  serviceRequestId: string;
  appointmentId: string;
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
    // lab orders & nursing orders use ServiceRequests
    // inHouse Medications use MedicationAdministration
    fhirResourceId: string;
    itemDescription: string;
    detailPageUrl: string;
    statusChip: JSX.Element;
  }[];
}

export interface OrdersForTrackingBoardTable {
  inHouseLabOrdersByAppointmentId: Record<string, InHouseOrderListPageItemDTO[]>;
  externalLabOrdersByAppointmentId: Record<string, LabOrderListPageDTO[]>;
  nursingOrdersByAppointmentId: Record<string, NursingOrder[]>;
  inHouseMedicationsByEncounterId: Record<string, ExtendedMedicationDataForResponse[]>;
}

export interface OrdersForTrackingBoardRow {
  inHouseLabOrders: InHouseOrderListPageItemDTO[] | undefined;
  externalLabOrders: LabOrderListPageDTO[] | undefined;
  nursingOrders: NursingOrder[] | undefined;
  inHouseMedications: ExtendedMedicationDataForResponse[] | undefined;
}
