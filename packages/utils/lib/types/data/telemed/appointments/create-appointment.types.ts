import { Address, Appointment, Encounter, Meta, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { PatientBaseInfo } from '../../../common';

export interface CreateAppointmentUCTelemedParams {
  patient?: PatientInfo;
  locationState?: string;
  timezone: string;
  unconfirmedDateOfBirth?: string;
}

export interface CreateAppointmentUCTelemedResponse {
  message: string;
  appointmentId: string;
  patientId: string;
  encounterId: string;
  questionnaireId: string;
  relatedPersonId: string;
  resources: {
    appointment: Appointment;
    encounter: Encounter;
    questionnaire: QuestionnaireResponse;
    patient: Patient;
  };
}

export enum VisitType {
  WalkIn = 'walkin',
  PreBook = 'prebook',
  Reschedule = 'reschedule',
  PostTelemed = 'posttelemed',
}

export type PatientInfo = PatientBaseInfo & {
  newPatient?: boolean;
  chosenName?: string;
  sex?: Patient['gender'];
  weight?: number;
  weightLastUpdated?: string;
  email?: string;
  reasonForVisit?: string;
  reasonAdditional?: string;
  phoneNumber?: string;
  pointOfDiscovery?: boolean;
  authorizedNonLegalGuardians?: string;
  telecom?: {
    system: string;
    value: string;
  }[];
  ssn?: string;
  address?: Address[];
  tags?: Meta['tag'];
  patientBeenSeenBefore?: boolean; // this differs from newPatient in that it is based on patient report rather than EHR data, and is used to determine whether to show the "Have you been seen at this clinic before?" question in the UI, whereas newPatient is used to determine certain logic in the backend around whether to create a new patient record or not. The use case is to identify patients who might have a corresponding record existing in a legacy system.
};
