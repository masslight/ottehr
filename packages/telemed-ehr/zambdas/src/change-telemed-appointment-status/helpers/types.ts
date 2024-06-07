import { Account, Appointment, ChargeItem, Encounter, Patient } from 'fhir/r4';

export interface AppointmentPackage {
  appointment: Appointment;
  encounter: Encounter;
  chargeItem?: ChargeItem;
  patient?: Patient;
  account?: Account;
}
