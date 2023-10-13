import { FhirClient, ZambdaClient } from '@zapehr/sdk';
import { Location, Patient, Slot } from 'fhir/r4';

export enum AdditionalInformationOptions {
  'Drive by/Signage' = 'Drive by/Signage',
  'Friend/Family' = 'Friend/Family',
  'Healthcare Professional' = 'Healthcare Professional',
  'Google/internet search' = 'Google/internet search',
  'Internet ad' = 'Internet ad',
  'Newsletter' = 'Newsletter',
  'School' = 'School',
  'Social media community group' = 'Social media community group',
  'TV/Radio' = 'TV/Radio',
  'Webinar' = 'Webinar',
}

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
  Male = 'male',
  Female = 'female',
  Other = 'other',
}

export enum RelationshipToPatientOptions {
  'Legal Guardian' = 'Legal Guardian',
  'Father' = 'Father',
  'Mother' = 'Mother',
  'Self' = 'Self',
  'Spouse ' = 'Spouse ',
}

export enum ResponsiblePartySex {
  Male = 'male',
  Female = 'female',
  Other = 'other',
}

export enum ResponsiblePartyRelationship {
  'Legal Guardian' = 'Legal Guardian',
  'Father' = 'Father',
  'Mother' = 'Mother',
  'Self' = 'Self',
  'Spouse' = 'Spouse',
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
  | { type: 'SET_FHIR_CLIENT'; fhirClient: FhirClient }
  | { type: 'SET_ZAMBDA_CLIENT'; zambdaClient: ZambdaClient }
  | { type: 'UPDATE_ADDITIONAL_INFORMATION'; additionalInformation: string }
  | { type: 'UPDATE_APPOINTMENT_ID'; appointmentId: string }
  | { type: 'UPDATE_APPOINTMENT_SLOT'; appointmentSlot: string }
  | { type: 'UPDATE_CANCELLATION_REASON'; cancellationReason: string }
  | { type: 'UPDATE_CONSENT_FORM_ID'; consentFormId: string }
  | { type: 'UPDATE_CONSENT_FORM_SIGNER_ID'; consentFormSignerId: string }
  | { type: 'UPDATE_COVERAGE_ID'; coverageId: string }
  | { type: 'UPDATE_LOCATIONS'; locations: Location[] }
  | { type: 'UPDATE_LOCATION_ID'; locationId: string }
  | { type: 'UPDATE_PATIENT'; patient: PatientInfo | undefined }
  | { type: 'UPDATE_PATIENTS'; patients: Patient[] }
  | { type: 'UPDATE_PHONE_NUMBER'; phoneNumber: string }
  | { type: 'UPDATE_RELATED_PERSON_ID'; relatedPersonId: string }
  | { type: 'UPDATE_RESPONSIBLE_PARTY_ID'; responsiblePartyId: string }
  | { type: 'UPDATE_SELECTED_APPOINTMENT_SLOT_ID'; selectedApptSlotId: string }
  | { type: 'UPDATE_SELECTED_LOCATION'; location: Location }
  | { type: 'UPDATE_SLOTS'; slots: Slot[] }
  | { type: 'UPDATE_SUBMITTED_INSURANCE_TYPE'; submittedInsuranceType: string }
  | { type: 'UPDATE_TIMEZONE'; timezone: string };

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
