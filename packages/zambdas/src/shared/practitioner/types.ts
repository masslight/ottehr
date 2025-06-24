import { Appointment, Encounter, Location, Patient, Practitioner, PractitionerRole } from 'fhir/r4b';

export interface EncounterPackage {
  appointment: Appointment;
  encounter: Encounter;
  patient?: Patient;
  location?: Location;
  practitioner?: Practitioner;
  practitionerRole?: PractitionerRole;
}
