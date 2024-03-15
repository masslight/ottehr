import { Secrets } from 'ottehr-utils';
import { VisitStatusHistoryEntry } from '../../../../../ehr/zambdas/src/shared/fhirStatusMappingUtils';
import { TelemedCallStatuses } from '../../appointment.types';
export type PatientFilterType = 'my-patients' | 'all-patients';

export interface GetTelemedAppointmentsInput {
  dateFilter: string;
  stateFilter?: string;
  patientFilter: PatientFilterType;
  statusesFilter: TelemedCallStatuses[];
  secrets: Secrets | null;
}

export interface GetTelemedAppointmentsResponse {
  message: string;
  appointments: TelemedAppointmentInformation[];
}

export interface TelemedStatusHistoryElement {
  start?: string;
  end?: string;
  status?: TelemedCallStatuses;
}

export interface AppointmentLocation {
  locationId?: string;
  state?: string;
}

export interface TelemedAppointmentInformation {
  id: string;
  start?: string;
  patient: {
    id?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    sex?: string;
    phone?: string;
  };
  reasonForVisit?: string;
  comment: string | undefined;
  appointmentStatus: string;
  location: AppointmentLocation;
  estimated?: number;
  paperwork?: object;
  telemedStatus: TelemedCallStatuses;
  telemedStatusHistory: TelemedStatusHistoryElement[];
  cancellationReason: string | undefined;
  next: boolean;
  visitStatusHistory: VisitStatusHistoryEntry[];
}
