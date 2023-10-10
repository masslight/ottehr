import { FhirClient, ZambdaClient } from '@zapehr/sdk';
import { Location, Patient, Slot } from 'fhir/r4';

export enum AdditionalInformationOptions {
  'Friend/Family' = 'Friend/Family',
  'Healthcare Professional' = 'Healthcare Professional',
  'Google/internet search' = 'Google/internet search',
  'Internet ad' = 'Internet ad',
  'Social media community group' = 'Social media community group',
  'Webinar' = 'Webinar',
  'TV/Radio' = 'TV/Radio',
  'Newsletter' = 'Newsletter',
  'School' = 'School',
  'Drive by/Signage' = 'Drive by/Signage',
}

export enum CancellationReasonCodes {
  'Duplicate Visit or Account Error' = 'duplicate-visit-account-error',
  'Financial Responsibility Concern' = 'financial-concern',
  'Non-par or inactive insurance' = 'inactive-insurance',
  'Patient improved' = 'patient-improved',
  'Wait Time' = 'wait-time',
  'Went to outside facility' = 'outside-facility',
}

export enum CancellationReasonOptions {
  'Duplicate Visit or Account Error' = 'Duplicate Visit or Account Error',
  'Financial Responsibility Concern' = 'Financial Responsibility Concern',
  'Non-par or inactive insurance' = 'Non-par or inactive insurance',
  'Patient improved' = 'Patient improved',
  'Wait Time' = 'Wait Time',
  'Went to outside facility' = 'Went to outside facility',
}

export enum PatientEthnicity {
  'Hispanic/Latino' = 'Hispanic/Latino',
  'Not Hispanic/Latino' = 'Not Hispanic/Latino',
  'Prefer not to answer' = 'Prefer not to answer',
}

export const PatientEthnicityCode = {
  'Hispanic/Latino': '2135-2',
  'Not Hispanic/Latino': '2186-5',
  'Prefer not to answer': undefined,
};

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

export const PatientRaceCode = {
  'American Indian or Alaskan Native': '1002-5',
  Asian: '2028-9',
  'Black or African American': '2054-5',
  'Hawaiian or Pacific Islander': '2076-8',
  Other: '2131-1',
  'Prefer not to answer': undefined,
  Unknown: undefined,
  White: '2106-3',
};

export enum PatientSex {
  Male = 'male',
  Female = 'female',
  Other = 'other',
}

export enum RelationshipToPatientOptions {
  'Self' = 'Self',
  'Legal Guardian' = 'Legal Guardian',
  'Father' = 'Father',
  'Mother' = 'Mother',
  'Spouse ' = 'Spouse ',
}

export enum ResponsiblePartySex {
  Male = 'male',
  Female = 'female',
  Other = 'other',
}

export enum ResponsiblePartyRelationship {
  'Self' = 'Self',
  'Legal Guardian' = 'Legal Guardian',
  'Father' = 'Father',
  'Mother' = 'Mother',
  'Spouse' = 'Spouse',
}

export type PatientInfo = {
  id: string | undefined;
  newPatient: boolean;
  firstName: string | undefined;
  lastName: string | undefined;
  dateOfBirth: string | undefined;
  sex: PatientSex | undefined;
  ethnicity: PatientEthnicity | undefined;
  race: PatientRace | undefined;
  reasonForVisit: string[] | undefined;
};

export type IntakeAction =
  | { type: 'SET_FHIR_CLIENT'; fhirClient: FhirClient }
  | { type: 'SET_ZAMBDA_CLIENT'; zambdaClient: ZambdaClient }
  | { type: 'UPDATE_PHONE_NUMBER'; phoneNumber: string }
  | { type: 'UPDATE_LOCATIONS'; locations: Location[] }
  | { type: 'UPDATE_SELECTED_LOCATION'; location: Location }
  | { type: 'UPDATE_LOCATION_ID'; locationId: string }
  | { type: 'UPDATE_SELECTED_APPOINTMENT_SLOT_ID'; selectedApptSlotId: string }
  | { type: 'UPDATE_PATIENTS'; patients: Patient[] }
  | { type: 'UPDATE_SUBMITTED_INSURANCE_TYPE'; submittedInsuranceType: string }
  | { type: 'UPDATE_RESPONSIBLE_PARTY_ID'; responsiblePartyId: string }
  | { type: 'UPDATE_RELATED_PERSON_ID'; relatedPersonId: string }
  | { type: 'UPDATE_CONSENT_FORM_SIGNER_ID'; consentFormSignerId: string }
  | { type: 'UPDATE_CONSENT_FORM_ID'; consentFormId: string }
  | { type: 'UPDATE_COVERAGE_ID'; coverageId: string }
  | { type: 'UPDATE_PATIENT'; patient: PatientInfo | undefined }
  | { type: 'UPDATE_APPOINTMENT_SLOT'; appointmentSlot: string }
  | { type: 'UPDATE_APPOINTMENT_ID'; appointmentId: string }
  | { type: 'UPDATE_TIMEZONE'; timezone: string }
  | { type: 'UPDATE_ADDITIONAL_INFORMATION'; additionalInformation: string }
  | { type: 'UPDATE_CANCELLATION_REASON'; cancellationReason: string }
  | { type: 'UPDATE_SLOTS'; slots: Slot[] };

export type IntakeState = {
  fhirClient?: FhirClient;
  zambdaClient?: ZambdaClient;
  phoneNumber?: string;
  patients?: Patient[];
  additionalInformation?: string;
  cancellationReason?: string;
  locations?: Location[];
  locationId?: string;
  selectedLocation?: Location;
  patientInfo?: PatientInfo;
  slots?: Slot[];
  appointmentSlot?: string;
  appointmentId?: string;
  timezone?: string;
  submittedInsuranceType?: string;
  relatedPersonId?: string;
  consentFormSignerId?: string;
  consentFormId?: string;
  selectedApptSlotId?: string;
  responsiblePartyId?: string;
  coverageId?: string;
};
