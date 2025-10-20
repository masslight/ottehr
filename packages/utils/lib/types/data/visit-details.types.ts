import { Appointment, Encounter, Flag, Patient } from 'fhir/r4b';
import { Timezone } from '..';

export interface EHRVisitDetails {
  appointment: Appointment;
  patient: Patient;
  encounter: Encounter;
  flags: Flag[];
  visitTimezone: Timezone;
  qrId: string;
  responsiblePartyName: string | null;
  responsiblePartyEmail: string | null;
  consentDetails: ConsentDetails | null;
  visitLocationName?: string;
  visitLocationId?: string;
}

export interface ConsentDetails {
  signature: string;
  fullName: string;
  relationshipToPatient: string;
  date: string;
  ipAddress?: string;
}
