import {
  Appointment,
  Coding,
  Encounter,
  Extension,
  HealthcareService,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponse,
  RelatedPerson,
} from 'fhir/r4b';
import { OTTEHR_MODULE } from '../../../fhir/moduleIdentification';
import {
  FhirAppointmentType,
  TelemedAppointmentStatusEnum,
  TelemedCallStatuses,
  TelemedStatusHistoryElement,
} from '../../../main';
import {
  AppointmentMessaging,
  AppointmentType,
  FhirAppointmentStatus,
  VisitStatusHistoryEntry,
  VisitStatusLabel,
} from '../../api';

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
  timezone?: string;
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
  reference?: string;
  name?: string;
  state?: string;
  resourceType: Location['resourceType'];
  id: string;
  extension?: Extension[];
}

export interface AppointmentInformation extends AppointmentMessaging {
  id: string;
  start?: string;
  reasonForVisit?: string;
  comment?: string;
  appointmentStatus: FhirAppointmentStatus;
  locationVirtual: AppointmentLocation;
  paperwork?: QuestionnaireResponse;
  encounter: Encounter;
  status: CallStatuses;
  statusHistory: StatusHistoryElement[];
  cancellationReason?: string;
  next: boolean;
  visitStatusHistory: VisitStatusHistoryEntry[];
  practitioner?: Practitioner;
  appointmentType?: AppointmentType;
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
  extends Omit<AppointmentInformation, 'paperwork' | 'locationVirtual' | 'location' | 'statusHistory'> {
  encounterId: string;
  start: string;
  unconfirmedDOB: string;
  reasonForVisit: string;
  status: VisitStatusLabel;
  paperwork: {
    demographics: boolean;
    photoID: boolean;
    insuranceCard: boolean;
    consent: boolean;
    ovrpInterest: boolean;
  };
  participants: AppointmentParticipants;
  provider?: string;
  group?: string;
  room?: string;
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

export const appointmentTypeLabels: { [type in FhirAppointmentType]: string } = {
  prebook: 'Pre-booked',
  walkin: 'Walk-In',
  posttelemed: 'Post Telemed',
};

export type PatientFilterType = 'my-patients' | 'all-patients';

export interface GetTelemedAppointmentsInput {
  dateFilter?: string;
  usStatesFilter?: string[];
  locationsIdsFilter?: string[];
  providersFilter?: string[];
  groupsFilter?: string[];
  patientFilter: PatientFilterType;
  statusesFilter: TelemedCallStatuses[];
  visitTypesFilter?: string[];
  userToken: string;
}

export const PRACTITIONER_CODINGS = {
  Admitter: [
    {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
      code: 'ADM',
      display: 'admitter',
    },
  ] as Coding[],
  Attender: [
    {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
      code: 'ATND',
      display: 'attender',
    },
  ] as Coding[],
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
