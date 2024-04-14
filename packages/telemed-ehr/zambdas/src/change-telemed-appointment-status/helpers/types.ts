import { Appointment, Encounter } from 'fhir/r4';

export interface AppointmentPackage {
  appointment: Appointment;
  encounter: Encounter;
}
