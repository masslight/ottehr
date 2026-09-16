import { Appointment, Encounter, Location, MedicationStatement, Patient, Practitioner, Reference } from 'fhir/r4b';
import { z } from 'zod';
import { MedicationIntakeInfo } from '../chart-data/chart-data.types';

export type MedicationInfoForPrinting = {
  name: string;
  type: 'scheduled' | 'as-needed' | 'prescribed-medication';
  id?: string;
  practitioner?: Practitioner | Reference;
  status: Extract<MedicationStatement['status'], 'active' | 'completed'>;
  intakeInfo?: MedicationIntakeInfo;
};

export type MakeMedicationHistoryPdfZambdaInput = {
  patient: Patient;
  medicationHistory: MedicationInfoForPrinting[];
  appointment: Appointment;
  encounter: Encounter;
  location?: Location;
  timezone?: string;
};

export type MakeMedicationHistoryPdfZambdaOutput = {
  presignedURL: string;
  title: string;
};

export const MEDICATION_HISTORY_DOC_REF_CODING = {
  system: 'http://loinc.org',
  code: '104202-7',
  display: 'Active medication list',
};

/**
 * A PDF rendered on demand for printing and handed back as a presigned URL.
 *
 * Nothing is filed against the chart: these are print-time renders of data that already lives in
 * the record, so creating a DocumentReference for each print would fill the patient's documents
 * with duplicates of the same content.
 */
export type PrintablePdfZambdaOutput = {
  presignedURL: string;
  title: string;
};

export const MakePatientInstructionsPdfInputSchema = z.object({
  appointmentId: z.string().uuid(),
});

export type MakePatientInstructionsPdfZambdaInput = z.infer<typeof MakePatientInstructionsPdfInputSchema>;

export type MakePatientInstructionsPdfZambdaOutput = PrintablePdfZambdaOutput;

export const MakeProgressNotePdfInputSchema = z.object({
  appointmentId: z.string().uuid(),
});

export type MakeProgressNotePdfZambdaInput = z.infer<typeof MakeProgressNotePdfInputSchema>;

export type MakeProgressNotePdfZambdaOutput = PrintablePdfZambdaOutput;
