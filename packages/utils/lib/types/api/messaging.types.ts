import { Appointment, Coding, Communication, Encounter, RelatedPerson } from 'fhir/r4b';

export const PATIENT_MESSAGE_SYSTEM = 'patient-message-status';
export const PATIENT_MESSAGE_CODE = 'read-by-staff';
export interface EvolvePatientMessageStatus extends Coding {
  system: typeof PATIENT_MESSAGE_SYSTEM;
  code: typeof PATIENT_MESSAGE_CODE;
}

export interface ConversationMessage {
  id: string; // represents the id of the underlying Communication resource
  sender: string;
  sentDay: string;
  sentTime: string;
  content: string;
  isRead: boolean;
  isFromPatient: boolean;
}

export interface SMSRecipient {
  recipientResourceUri: string;
  smsNumber: string;
}
export interface SMSModel {
  recipients: SMSRecipient[];
  hasUnreadMessages: boolean;
}

export interface AppointmentMessaging {
  id: NonNullable<Appointment['id']>;
  encounterId: NonNullable<Encounter['id']>;
  smsModel?: SMSModel;
  patient: {
    id: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    // suffix?: string;
    dateOfBirth: string;
    sex?: string;
    phone?: string;
  };
}

export type RelatedPersonMaps = {
  rpsToPatientIdMap: Record<string, RelatedPerson[]>;
  commsToRpRefMap: Record<string, Communication[]>;
};
