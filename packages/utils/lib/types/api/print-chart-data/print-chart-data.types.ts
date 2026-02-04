import { Appointment, Encounter, MedicationStatement, Patient, Practitioner, Reference } from 'fhir/r4b';

export type MedicationInfoForPrinting = {
  name: string;
  type: 'scheduled' | 'as-needed' | 'prescribed-medication';
  id?: string;
  practitioner?: Practitioner | Reference;
  status: Extract<MedicationStatement['status'], 'active' | 'completed'>;
};

export type MakeMedicationHistoryPdfZambdaInput = {
  patient: Patient;
  medicationHistory: MedicationInfoForPrinting[];
  appointment: Appointment;
  encounter: Encounter;
};

export type MakeMedicationHistoryPdfZambdaOutput = {
  medicationHistoryPdfUrl: string;
};

export const MEDICATION_HISTORY_DOC_REF_CODING = {
  system: 'http://loinc.org',
  code: '104202-7',
  display: 'Active medication list',
};
