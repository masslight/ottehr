import { FhirClient, ZambdaClient } from '@zapehr/sdk';
import { Location, Patient, Slot } from 'fhir/r4';

export enum PatientEthnicity {
  'Hispanic/Latino' = 'Hispanic/Latino',
  'Not Hispanic/Latino' = 'Not Hispanic/Latino',
  'Prefer not to answer' = 'Prefer not to answer',
}

export enum PatientRace {
  'American Indian or Alaskan Native' = 'American Indian or Alaskan Native',
  'Asian' = 'Asian',
  'Black or African American' = 'Black or African American',
  'Hawaiian or Pacific Islander' = 'Hawaiian or Pacific Islander',
  'Other' = 'Other',
  'Prefer not to answer' = 'Prefer not to answer',
  'Unknown' = 'Unknown',
  'White' = 'White',
}

export enum PatientSex {
  Female = 'female',
  Male = 'male',
  Other = 'other',
}

export type PatientInfo = {
  dateOfBirth: string | undefined;
  ethnicity: PatientEthnicity | undefined;
  firstName: string | undefined;
  id: string | undefined;
  lastName: string | undefined;
  newPatient: boolean;
  race: PatientRace | undefined;
  reasonForVisit: string[] | undefined;
  sex: PatientSex | undefined;
};

export type Action =
  | { additionalInformation: string; type: 'UPDATE_ADDITIONAL_INFORMATION' }
  | { appointmentId: string; type: 'UPDATE_APPOINTMENT_ID' }
  | { appointmentSlot: string; type: 'UPDATE_APPOINTMENT_SLOT' }
  | { cancellationReason: string; type: 'UPDATE_CANCELLATION_REASON' }
  | { consentFormId: string; type: 'UPDATE_CONSENT_FORM_ID' }
  | { consentFormSignerId: string; type: 'UPDATE_CONSENT_FORM_SIGNER_ID' }
  | { coverageId: string; type: 'UPDATE_COVERAGE_ID' }
  | { fhirClient: FhirClient; type: 'SET_FHIR_CLIENT' }
  | { locationId: string; type: 'UPDATE_LOCATION_ID' }
  | { locations: Location[]; type: 'UPDATE_LOCATIONS' }
  | { patientInfo: PatientInfo | undefined; type: 'UPDATE_PATIENT' }
  | { patients: Patient[]; type: 'UPDATE_PATIENTS' }
  | { phoneNumber: string; type: 'UPDATE_PHONE_NUMBER' }
  | { relatedPersonId: string; type: 'UPDATE_RELATED_PERSON_ID' }
  | { responsiblePartyId: string; type: 'UPDATE_RESPONSIBLE_PARTY_ID' }
  | { selectedApptSlotId: string; type: 'UPDATE_SELECTED_APPOINTMENT_SLOT_ID' }
  | { selectedLocation: Location; type: 'UPDATE_SELECTED_LOCATION' }
  | { slots: Slot[]; type: 'UPDATE_SLOTS' }
  | { submittedInsuranceType: string; type: 'UPDATE_SUBMITTED_INSURANCE_TYPE' }
  | { timezone: string; type: 'UPDATE_TIMEZONE' }
  | { type: 'SET_ZAMBDA_CLIENT'; zambdaClient: ZambdaClient };

export type State = {
  additionalInformation?: string;
  appointmentId?: string;
  appointmentSlot?: string;
  cancellationReason?: string;
  consentFormId?: string;
  consentFormSignerId?: string;
  coverageId?: string;
  fhirClient?: FhirClient;
  locationId?: string;
  locations?: Location[];
  patientInfo?: PatientInfo;
  patients?: Patient[];
  phoneNumber?: string;
  relatedPersonId?: string;
  responsiblePartyId?: string;
  selectedApptSlotId?: string;
  selectedLocation?: Location;
  slots?: Slot[];
  submittedInsuranceType?: string;
  timezone?: string;
  zambdaClient?: ZambdaClient;
};
