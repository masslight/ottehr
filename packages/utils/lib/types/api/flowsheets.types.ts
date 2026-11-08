import { MedicationRequest, QuestionnaireResponse } from 'fhir/r4b';
import { z } from 'zod';
import { LmsRow } from '../../helpers/vitals/growth-lms';
import { VitalAlertCriticality } from './chart-data/chart-data.constants';

/** The flowsheets the EHR registry offers; the get-flowsheet zambda accepts nothing else. */
export const FLOWSHEET_IDS = ['vitals', 'growth'] as const;
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
  visitType: string;
  reason: string;
  primaryDiagnosis: string;
  attending: string;
  /** Measure key (see the EHR registry) -> the visit's reading. */
  values: Record<string, FlowsheetValue>;
}

export interface GetFlowsheetOutput {
  visits: FlowsheetVisit[];
  /** Growth flowsheet only; absent without a full birth date and a male/female sex. */
  growth?: GrowthChartData;
}

// The growth charts (ported from the OTR-3741 growth-charts report): WHO birth to 24 months, CDC 2 to 20 years.

export type GrowthChartSet = 'who' | 'cdc';
/** wfa = weight-for-age, lfa = length-for-age, wfl = weight-for-length, hcfa = head circumference-for-age, sfa = stature-for-age. */
export const GROWTH_CHART_IDS = ['who-wfa', 'who-lfa', 'who-wfl', 'who-hcfa', 'cdc-wfa', 'cdc-sfa', 'cdc-bmi'] as const;
export type GrowthChartId = (typeof GROWTH_CHART_IDS)[number];

/** One visit's measurement on one growth chart. */
export interface GrowthChartPoint {
  chart: GrowthChartId;
  encounterId?: string;
  /** The measurement's time (ISO). */
  time: string;
  /** Age at the measurement, clinical style ("3 d", "12 mo", "4 y 6 mo"). */
  age: string;
  /** Age in months, or the same visit's length in cm on weight-for-length. */
  x: number;
  y: number;
  /** z-score; absent when x is outside the chart's table. */
  z?: number;
  /** "88th", "<1st", ">99th"; absent when the point is not on the line (see note). */
  percentile?: string;
  /** Biologically implausible, or built from an implausible measurement: a red ✕, kept off the line. */
  implausible?: boolean;
  /** Why the point is not on the line, when it is not. */
  note?: string;
}

export interface GrowthChartData {
  sex: 'male' | 'female';
  /** Age in months at asOf (this visit), else now: the chart set that opens. */
  ageMonths?: number;
  /** Oldest first. */
  points: GrowthChartPoint[];
  /** Per chart, how many measurements of its measure fall outside its set's age range. */
  outsideRange: Partial<Record<GrowthChartId, number>>;
  /** The LMS rows of every chart for the patient's sex, for the percentile curves. */
  tables: Record<GrowthChartId, LmsRow[]>;
}

// The per-patient data the flowsheet fetchers shape their rows from. Per-visit kinds are keyed by encounter id.

/** One of a visit's charted diagnoses (ICD-10); the primary one comes first in its list. */
export interface FlowsheetDiagnosis {
  code: string;
  display: string;
  primary: boolean;
}

/** One Medical Conditions (problem list) entry. */
export interface FlowsheetProblem {
  code: string;
  display: string;
  status: 'active' | 'inactive';
}

export interface PatientDiagnoses {
  byEncounter: Record<string, FlowsheetDiagnosis[]>;
  problemList: FlowsheetProblem[];
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

/** One Medications page (medication list) entry. */
export interface FlowsheetListMedication {
  name: string;
  status: 'active' | 'completed';
  /** Free-text dose / sig as charted. */
  dose: string;
  source: 'patient-reported' | 'prescribed';
}

export interface PatientMedications {
  byEncounter: Record<string, FlowsheetMedication[]>;
  medicationList: FlowsheetListMedication[];
}

/** A value the form computed itself (a hidden calculated item, e.g. total, severity, positive screen). */
export interface FlowsheetFormResult {
  linkId: string;
  label: string;
  value: number | string | boolean;
}

/** A completed practice form; `results` is empty when the form computes nothing. */
export interface FlowsheetForm {
  name: string;
  status: QuestionnaireResponse['status'];
  completedAt?: string;
  results: FlowsheetFormResult[];
}

export interface FlowsheetLabResult {
  analyte: string;
  loincCodes: string[];
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
