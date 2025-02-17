import {
  Appointment,
  Encounter,
  HealthcareService,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponse,
  RelatedPerson,
} from 'fhir/r4b';

import { OTTEHR_MODULE } from '../../../fhir/moduleIdentification';
import {
  AppointmentMessaging,
  AppointmentType,
  FhirAppointmentStatus,
  VisitStatusHistoryEntry,
  VisitStatusLabel,
} from '../../api';
import { TelemedAppointmentStatusEnum, TelemedCallStatuses, TelemedStatusHistoryElement } from '../telemed';

export interface GetPastVisitsResponse {
  appointments: AppointmentInformationIntake[];
}

export interface AppointmentInformationIntake {
  id: string;
  start?: string;
  patient: {
    id?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  };
  appointmentStatus: string;
  status: AppointmentStatus;
  state?: { code?: string; id?: string };
  type?: string;
}

export type AppointmentStatus = TelemedAppointmentStatusEnum | VisitStatusLabel;

export type CallStatuses = `${AppointmentStatus}`;
export const CallStatusesArr = ['ready', 'pre-video', 'on-video', 'unsigned', 'complete', 'cancelled'];

export interface StatusHistoryElement {
  start?: string;
  end?: string;
  status?: CallStatuses;
}

export interface AppointmentsResponse<T> {
  message: string;
  appointments: T[];
}

export type GetAppointmentsResponseEhr = AppointmentsResponse<AppointmentInformation>;
export type GetTelemedAppointmentsResponseEhr = AppointmentsResponse<TelemedAppointmentInformation>;

export interface AppointmentLocation {
  locationID?: string;
  state?: string;
}

export interface AppointmentInformation extends AppointmentMessaging {
  id: string;
  start?: string;
  reasonForVisit?: string;
  comment?: string;
  appointmentStatus: FhirAppointmentStatus;
  location: AppointmentLocation;
  paperwork?: QuestionnaireResponse;
  encounter: Encounter;
  status: CallStatuses;
  statusHistory: StatusHistoryElement[];
  cancellationReason?: string;
  next: boolean;
  visitStatusHistory: VisitStatusHistoryEntry[];
  practitioner?: Practitioner;
}

export interface ParticipantInfo {
  firstName: string;
  lastName: string;
}

export interface AppointmentParticipants {
  admitter?: ParticipantInfo;
  attender?: ParticipantInfo;
}

export interface InPersonAppointmentInformation
  extends Omit<AppointmentInformation, 'paperwork' | 'location' | 'statusHistory'> {
  encounterId: string;
  start: string;
  unconfirmedDOB: string;
  reasonForVisit: string;
  appointmentType?: AppointmentType;
  status: VisitStatusLabel;
  provider?: string;
  group?: string;
  paperwork: {
    demographics: boolean;
    photoID: boolean;
    insuranceCard: boolean;
    consent: boolean;
    ovrpInterest: boolean;
  };
  participants: AppointmentParticipants;
  needsDOBConfirmation?: boolean;
  waitingMinutes?: number;
}

export interface TelemedAppointmentInformation extends Omit<AppointmentInformation, 'status' | 'statusHistory'> {
  telemedStatus: TelemedCallStatuses;
  telemedStatusHistory: TelemedStatusHistoryElement[];
  provider?: string[];
  group?: string[];
}

export interface GetAppointmentsRequest {
  patientId?: string;
}

export const appointmentTypeMap: Record<string, string> = {
  [OTTEHR_MODULE.IP]: 'In-Person',
  [OTTEHR_MODULE.TM]: 'Telemedicine',
};

export type PatientFilterType = 'my-patients' | 'all-patients';

export interface GetTelemedAppointmentsInput {
  dateFilter?: string;
  usStatesFilter?: string[];
  providersFilter?: string[];
  groupsFilter?: string[];
  patientFilter: PatientFilterType;
  statusesFilter: TelemedCallStatuses[];
  userToken: string;
}

export const PARTICIPANT_TYPE = {
  ADMITTER: 'ADM',
  ATTENDER: 'ATND',
};

export type AppointmentRelatedResources =
  | Appointment
  | Encounter
  | Location
  | Patient
  | QuestionnaireResponse
  | Practitioner
  | RelatedPerson
  | HealthcareService;
