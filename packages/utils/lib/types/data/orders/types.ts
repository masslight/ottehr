import { z } from 'zod';
import { Secrets } from '../../../secrets';
import { ExtendedMedicationDataForResponse } from '../../api';
import { InHouseOrderListPageItemDTO } from '../in-house';
import { LabOrderListPageDTO } from '../labs';
import { NursingOrdersStatus } from './constants';

export const CreateNursingOrderInputSchema = z.object({
  encounterId: z.string().uuid(),
  notes: z.string().optional(),
});

export type CreateNursingOrderInput = z.infer<typeof CreateNursingOrderInputSchema>;

export const CreateNursingOrderInputValidatedSchema = CreateNursingOrderInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
  userToken: z.string(),
});

export type CreateNursingOrderInputValidated = z.infer<typeof CreateNursingOrderInputValidatedSchema>;

export const UpdateNursingOrderInputSchema = z.object({
  serviceRequestId: z.string(),
  action: z.enum(['CANCEL ORDER', 'COMPLETE ORDER']),
});

export type UpdateNursingOrderInput = z.infer<typeof UpdateNursingOrderInputSchema>;

export const UpdateNursingOrderInputValidatedSchema = UpdateNursingOrderInputSchema.extend({
  userToken: z.string(),
  secrets: z.custom<Secrets>().nullable(),
});

export type UpdateNursingOrderInputValidated = z.infer<typeof UpdateNursingOrderInputValidatedSchema>;

export const NursingOrdersSearchBySchema = z.discriminatedUnion('field', [
  z.object({
    field: z.literal('encounterId'),
    value: z.string(),
  }),
  z.object({
    field: z.literal('encounterIds'),
    value: z.array(z.string()),
  }),
  z.object({
    field: z.literal('serviceRequestId'),
    value: z.string(),
  }),
]);

export type NursingOrdersSearchBy = z.infer<typeof NursingOrdersSearchBySchema>;

export const GetNursingOrdersInputSchema = z.object({
  searchBy: NursingOrdersSearchBySchema,
});

export type GetNursingOrdersInput = z.infer<typeof GetNursingOrdersInputSchema>;

export const GetNursingOrdersInputValidatedSchema = GetNursingOrdersInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
});

export type GetNursingOrdersInputValidated = z.infer<typeof GetNursingOrdersInputValidatedSchema>;

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
