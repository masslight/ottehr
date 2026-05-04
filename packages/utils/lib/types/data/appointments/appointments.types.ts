import {
  Appointment,
  Coding,
  Encounter,
  Extension,
  HealthcareService,
  Location,
  Patient,
  Person,
  Practitioner,
  QuestionnaireResponse,
  RelatedPerson,
} from 'fhir/r4b';
import { z } from 'zod';
import { OTTEHR_MODULE } from '../../../fhir/moduleIdentification';
import { FhirAppointmentType, ProviderTypeCode, Secrets } from '../../../main';
import {
  AppointmentAttendanceType,
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
  status: VisitStatusLabel;
  state?: { code?: string; id?: string };
  timezone?: string;
  type?: string;
}

export interface StatusHistoryElement {
  start?: string;
  end?: string;
  status?: VisitStatusLabel;
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
  status: VisitStatusLabel;
  statusHistory: StatusHistoryElement[];
  cancellationReason?: string;
  next: boolean;
  visitStatusHistory: VisitStatusHistoryEntry[];
  practitioner?: Practitioner;
  appointmentType?: AppointmentType;
  appointmentAttendanceType?: AppointmentAttendanceType;
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
  attenderProviderType?: ProviderTypeCode;
  approvalDate?: string;
  group?: string;
  room?: string;
  needsDOBConfirmation?: boolean;
  waitingMinutes?: number;
  serviceCategory?: string;
  location?: Location;
  isFollowUp?: boolean;
  parentEncounterId?: string;
  parentAppointmentId?: string;
}

export interface TelemedAppointmentInformation extends AppointmentInformation {
  provider?: string[];
  group?: string[];
  serviceCategory?: string;
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
  appointmentId?: string;
  timeZone?: string;
  dateFilter?: string;
  usStatesFilter?: string[];
  locationsIdsFilter?: string[];
  providersFilter?: string[];
  groupsFilter?: string[];
  patientFilter: PatientFilterType;
  statusesFilter: VisitStatusLabel[];
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
  | HealthcareService
  | Person;

export const PendingSupervisorApprovalInputSchema = z.object({
  encounterId: z.string().uuid(),
  practitionerId: z.string().uuid(),
});

export type PendingSupervisorApprovalInput = z.infer<typeof PendingSupervisorApprovalInputSchema>;

export const PendingSupervisorApprovalInputValidatedSchema = PendingSupervisorApprovalInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
});

export type PendingSupervisorApprovalInputValidated = z.infer<typeof PendingSupervisorApprovalInputValidatedSchema>;
