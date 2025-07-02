import {
  Account,
  Appointment,
  ChargeItem,
  Coverage,
  DocumentReference,
  Encounter,
  InsurancePlan,
  List,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponse,
} from 'fhir/r4b';
import { Timezone } from 'utils';

export interface FullAppointmentResourcePackage {
  appointment: Appointment;
  encounter: Encounter;
  timezone: Timezone;
  chargeItem?: ChargeItem;
  patient?: Patient;
  account?: Account;
  location?: Location;
  questionnaireResponse?: QuestionnaireResponse;
  practitioner?: Practitioner;
  documentReferences?: DocumentReference[];
  listResources: List[];
  insurancePlan?: InsurancePlan;
  coverage?: Coverage;
}
