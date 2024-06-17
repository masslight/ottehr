import { Encounter, QuestionnaireResponse } from 'fhir/r4';
import { TelemedCallStatuses } from '../../appointment.types';
import { AppointmentMessaging } from '../../messaging.types';
import { Secrets, VisitStatusHistoryEntry } from '../../../../lib/main';
export type PatientFilterType = 'my-patients' | 'all-patients';

export interface GetTelemedAppointmentsInput {
  dateFilter: string;
  stateFilter?: string;
  providersFilter?: string[];
  groupsFilter?: string[];
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
  locationID?: string;
  state?: string;
}

export interface TelemedAppointmentInformation extends AppointmentMessaging {
  id: string;
  start?: string;
  reasonForVisit?: string;
  comment: string | undefined;
  appointmentStatus: string;
  location: AppointmentLocation;
  provider?: string[];
  group?: string[];
  estimated?: number;
  paperwork?: QuestionnaireResponse;
  encounter: Encounter;
  telemedStatus: TelemedCallStatuses;
  telemedStatusHistory: TelemedStatusHistoryElement[];
  cancellationReason: string | undefined;
  next: boolean;
  visitStatusHistory: VisitStatusHistoryEntry[];
}
