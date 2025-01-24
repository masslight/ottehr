import {
  Account,
  Appointment,
  ChargeItem,
  Coverage,
  DocumentReference,
  Encounter,
  InsurancePlan,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponse,
} from 'fhir/r4b';

export interface VideoResourcesAppointmentPackage {
  appointment: Appointment;
  encounter: Encounter;
  chargeItem?: ChargeItem;
  patient?: Patient;
  account?: Account;
  location?: Location;
  questionnaireResponse?: QuestionnaireResponse;
  practitioner?: Practitioner;
  documentReferences?: DocumentReference[];
  insurancePlan?: InsurancePlan;
  coverage?: Coverage;
}
