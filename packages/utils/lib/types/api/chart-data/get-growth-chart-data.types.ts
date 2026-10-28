import type { Observation } from 'fhir/r4b';
import { z } from 'zod';

export const GetGrowthChartDataInputSchema = z.object({
  patientId: z.string().uuid(),
});
export type GetGrowthChartDataInput = z.infer<typeof GetGrowthChartDataInputSchema>;

/** Every weight and height Observation of the patient, across all visits (meta, value, encounter, effective). */
export interface GetGrowthChartDataOutput {
  observations: Observation[];
}
