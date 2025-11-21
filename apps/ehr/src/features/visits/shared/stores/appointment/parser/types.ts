import { Appointment, Encounter, Location, Patient } from 'fhir/r4b';
import { PaymentVariant } from 'utils';
import { FillingOutAs, Gender } from './constants';

export type VisitDataAndMappedData = {
  resources: VisitResources;
  mappedData: VisitMappedData;
};

export type VisitResources = Partial<{
  appointment: AppointmentValues;
  location: LocationValues;
  locationVirtual: LocationValues;
  encounter: EncounterValues;
  questionnaire: QuestionnaireResponseValues;
  patient: PatientValues;
}>;

export type VisitMappedData = Partial<{
  firstName: string;
  lastName: string;
  birthDate: string;
  addressStreet1: string;
  addressStreet2: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  race: string;
  ethnicity: string;
  email: string;
  phone: string;
  patientName: string;
  patientAvatarPhotoUrl: string;
  patientConditionalPhotosUrls: string[];
  schoolWorkNoteUrls: string[];
  pronouns: string;
  gender: Gender;
  preferredLanguage: string;
  DOB: string;
  hospitalizations: string[];
  allergies: string;
  weight: string;
}>;

export type AppointmentValues = Partial<Pick<Appointment, 'id' | 'start' | 'end' | 'status' | 'description'>> & {
  appointmentType?: string;
};

export type PatientValues = Partial<
  Pick<Patient, 'id' | 'gender' | 'birthDate'> & {
    firstName: string;
    lastName: string;
    address: AddressValues;
    email: string;
    phone: string;
    ethnicity: string;
    race: string;
    weight: string;
    weightLastUpdated: string;
  }
>;

export type LocationValues = Partial<
  Pick<Location, 'id' | 'name'> & {
    address: Partial<AddressValues>;
    phone: string;
  }
>;

export type EncounterValues = Partial<
  Pick<Encounter, 'id' | 'status'> & {
    payment: PaymentVariant;
  }
>;

export type QuestionnaireResponseValues = Partial<{
  willBe18: boolean;
  isNewPatient: boolean;
  firstName: string;
  lastName: string;
  birthDateYear: string;
  birthDateMonth: string;
  birthDateDay: string;
  birthDate: string;
  birthSex: Gender;
  addressStreet1: string;
  addressStreet2: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  fillingOutAs: FillingOutAs;
  guardianEmail: string;
  guardianNumber: string;
  ethnicity: string;
  race: string;
  pronouns: string;
  customPronouns: string;
}>;

export type AddressValues = Partial<{
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
}>;
