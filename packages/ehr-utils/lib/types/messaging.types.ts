import { Appointment, Coding } from 'fhir/r4';

export const OTTEHR_PATIENT_MESSAGE_SYSTEM = 'ottehr-patient-message-status';
export const OTTEHR_PATIENT_MESSAGE_CODE = 'read-by-ottehr';
export interface OttehrPatientMessageStatus extends Coding {
  system: typeof OTTEHR_PATIENT_MESSAGE_SYSTEM;
  code: typeof OTTEHR_PATIENT_MESSAGE_CODE;
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
  relatedPersonId: string;
  smsNumber: string;
}
export interface SMSModel {
  recipients: SMSRecipient[];
  hasUnreadMessages: boolean;
}

export interface AppointmentMessaging {
  id: NonNullable<Appointment['id']>;
  smsModel?: SMSModel;
  patient: {
    id: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth: string;
    sex?: string;
    phone?: string;
  };
}
