import { Appointment, Encounter, Flag, Patient } from 'fhir/r4b';
import { Timezone } from '../common';
import { StandaloneFormDTO } from './practice-managed-questionnaires/practice-managed-questionnaire.types';

export interface EHRVisitDetails {
  appointment: Appointment;
  patient: Patient;
  encounter: Encounter;
  flags: Flag[];
  visitTimezone: Timezone;
  qrId: string;
  consentIsAttested: boolean;
  responsiblePartyName: string | null;
  responsiblePartyEmail: string | null;
  consentDetails: ConsentDetails | null;
  visitLocationName?: string;
  visitLocationId?: string;
  standAloneForms?: StandaloneFormDTO[];
}

export interface ConsentDetails {
  signature: string;
  fullName: string;
  relationshipToPatient: string;
  date: string;
}
