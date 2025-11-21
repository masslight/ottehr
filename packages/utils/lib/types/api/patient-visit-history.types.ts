import { Encounter, Task } from 'fhir/r4b';
import { ServiceMode } from '../common';
import { TelemedAppointmentStatusEnum } from '../data';
import { AppointmentType, VisitStatusLabel } from './appointment.types';

export interface GetPatientVisitListInput {
  patientId: string;
  type?: AppointmentType[];
  serviceMode?: ServiceMode;
  status?: string[];
  from?: string; // ISO date string
  to?: string; // ISO date string
  sortDirection?: 'asc' | 'desc';
}

interface BaseAppointmentHistoryRow {
  appointmentId: string;
  type: AppointmentType | undefined;
  length: number;
  serviceMode: ServiceMode;
  visitReason: string | undefined;
  office: string | undefined;
  dateTime: string | undefined;
  encounterId: string | undefined;
  sendInvoiceTask: Task | undefined;
  provider:
    | {
        name: string;
        id: string;
      }
    | undefined;
}

export interface FollowUpVisitHistoryRow {
  encounterId: string;
  originalEncounterId: string | undefined;
  originalAppointmentId: string | undefined;
  status: Encounter['status'];
  type: string | undefined;
  dateTime: string | undefined;
  visitReason: string | undefined;
  office: string | undefined;
  provider:
    | {
        name: string;
        id: string;
      }
    | undefined;
}

type InPersonAppointmentHistoryRow = BaseAppointmentHistoryRow & {
  serviceMode: Omit<ServiceMode, 'virtual'>;
  status: VisitStatusLabel | undefined;
  followUps: FollowUpVisitHistoryRow[] | undefined;
};
type VirtualAppointmentHistoryRow = BaseAppointmentHistoryRow & {
  serviceMode: ServiceMode.virtual;
  status: TelemedAppointmentStatusEnum | undefined;
  followUps: FollowUpVisitHistoryRow[] | undefined;
};

export type AppointmentHistoryRow = InPersonAppointmentHistoryRow | VirtualAppointmentHistoryRow;

export interface PatientVisitListResponse {
  visits: AppointmentHistoryRow[];
  metadata: {
    totalCount: number;
    sortDirection: 'asc' | 'desc';
  };
}
