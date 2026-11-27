import { z } from 'zod';
import { FollowupSubtype } from '../../fhir/encounter';
import { ServiceMode } from '../common';
import { AppointmentType } from './appointment.types';
import { VitalAlertCriticality, VitalFieldNames } from './chart-data/chart-data.constants';

export const FLOWSHEET_IDS = ['vitals'] as const;
export type FlowsheetId = (typeof FLOWSHEET_IDS)[number];

export const GetFlowsheetInputSchema = z.object({
  patientId: z.string().uuid(),
  flowsheetId: z.enum(FLOWSHEET_IDS),
  currentEncounterId: z.string().uuid().optional(),
});
export type GetFlowsheetInput = z.infer<typeof GetFlowsheetInputSchema>;

export type FlowsheetVitalField = Exclude<
  VitalFieldNames,
  VitalFieldNames.VitalVision | VitalFieldNames.VitalLastMenstrualPeriod
>;

export type FlowsheetMeasureKey = FlowsheetVitalField;

export interface FlowsheetReading {
  time: string;
  // One number per vital; a blood pressure is [systolic, diastolic].
  values: number[];
  flag?: VitalAlertCriticality;
}

export type FlowsheetValues = Partial<Record<FlowsheetMeasureKey, FlowsheetReading[]>>;

export interface FlowsheetVisit {
  appointmentId?: string;
  encounterId?: string;
  start: string;
  timezone?: string;
  isFollowUp: boolean;
  followupSubtype?: FollowupSubtype;
  originalAppointmentId?: string;
  followUpType?: string;
  appointmentType?: AppointmentType;
  serviceMode?: ServiceMode;
  serviceCategory?: string;
  reason: string;
  primaryDiagnosis: string;
  provider: string;
  values: FlowsheetValues;
}

export interface GetFlowsheetOutput {
  visits: FlowsheetVisit[];
}
