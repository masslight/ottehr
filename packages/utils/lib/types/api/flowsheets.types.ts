import { z } from 'zod';
import { VitalAlertCriticality } from './chart-data/chart-data.constants';

/** The flowsheets the EHR registry offers; the get-flowsheet zambda accepts nothing else. */
export const FLOWSHEET_IDS = ['vitals'] as const;
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
  value: number;
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
}
