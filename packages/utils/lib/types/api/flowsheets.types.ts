import { MedicationRequest } from 'fhir/r4b';
import { z } from 'zod';
import { VitalAlertCriticality } from './chart-data/chart-data.constants';

/** The flowsheets the EHR registry offers; the get-flowsheet zambda accepts nothing else. */
export const FLOWSHEET_IDS = ['labResults', 'newbornBilirubin', 'thyroid', 'vitals'] as const;
export type FlowsheetId = (typeof FLOWSHEET_IDS)[number];

export const GetFlowsheetInputSchema = z.object({
  patientId: z.string().uuid(),
  flowsheetId: z.enum(FLOWSHEET_IDS),
  /** Only visits dated on or before this instant are returned. */
  asOf: z.string().datetime({ offset: true }).optional(),
});
export type GetFlowsheetInput = z.infer<typeof GetFlowsheetInputSchema>;

export interface FlowsheetReading {
  /** The reading's effective time (ISO). */
  time: string;
  /** A number for measures and lab values; text for things like a medication name with its strength. */
  value: number | string;
  /** Shown after the value when the row label does not carry the unit (lab units vary by lab). */
  unit?: string;
  /** A fixed qualifier shown in parentheses after the value, e.g. "fasting" on a fasting glucose. */
  note?: string;
  /** The criticality saved on the Observation; never recomputed. */
  flag?: VitalAlertCriticality;
}

/** The latest reading of a measure in a visit, plus every reading of it (oldest first). */
export interface FlowsheetValue extends FlowsheetReading {
  readings: FlowsheetReading[];
}

export interface FlowsheetVisit {
  appointmentId?: string;
  encounterId?: string;
  /** Appointment start, or the first reading's time when the readings are not linked to an appointment. */
  start: string;
  /** The visit location's IANA time zone, for calendar-day math; absent when the visit has no location. */
  timezone?: string;
  isFollowUp: boolean;
  /** An unlinked outside result (matched to the patient, not to a visit): a column of its own, dated by the result. */
  isOutsideResult?: boolean;
  visitType: string;
  reason: string;
  primaryDiagnosis: string;
  attending: string;
  /** Measure key (see the EHR registry) -> the visit's reading. */
  values: Record<string, FlowsheetValue>;
}

export interface GetFlowsheetOutput {
  visits: FlowsheetVisit[];
}

// The per-patient data the flowsheet fetchers shape their rows from. Per-visit kinds are keyed by encounter id.

/** One of a visit's charted diagnoses (ICD-10); the primary one comes first in its list. */
export interface FlowsheetDiagnosis {
  code: string;
  display: string;
  primary: boolean;
}

/** A drug prescribed (eRx) or given in the clinic (in-house) during a visit; the name carries the strength. */
export interface FlowsheetMedication {
  name: string;
  source: 'eRx' | 'in-house';
  /** eRx: the prescription status; in-house: the order status (pending, administered, ...). */
  status: MedicationRequest['status'] | string;
  /** In-house only: the dose given, e.g. "2.5 mg". */
  dose?: string;
  /** eRx: when it was written; in-house: when it was given (or ordered, if never given). */
  time?: string;
}

export interface FlowsheetLabResult {
  analyte: string;
  loincCodes: string[];
  /** The ordered test (or, unordered, the report), which places results the lab did not code (culture organisms). */
  testName: string;
  testLoincCodes: string[];
  /** The report's fasting status says the patient was fasting. */
  fasting?: boolean;
  /** Numeric result; absent for text or coded results (see valueText). */
  value?: number;
  valueText: string;
  unit: string;
  referenceRange: string;
  /** The interpretation code the lab saved (e.g. H, L, N, A); '' when none. Never recomputed. */
  interpretation: string;
  /** The grid flag for that saved interpretation. */
  flag?: VitalAlertCriticality;
  resultedAt?: string;
  source: 'external' | 'in-house';
}
