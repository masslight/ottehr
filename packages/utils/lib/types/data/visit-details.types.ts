import { Appointment, Encounter, Flag, Patient } from 'fhir/r4b';
import { StandaloneFormDTO, Timezone } from '..';

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
  /** Custom (practice-managed) forms bundled into the visit's paperwork flow, shaped like standAloneForms. */
  intakePaperworkFlowForms?: StandaloneFormDTO[];
}

export interface ConsentDetails {
  signature: string;
  fullName: string;
  relationshipToPatient: string;
  date: string;
}
