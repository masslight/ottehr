import z from 'zod';
import { PrescribedMedicationDTO } from './chart-data';

export const GetErxOrdersInputSchema = z.object({
  encounterIds: z.array(z.string()),
  refreshKey: z.number().optional(),
});

export type GetErxOrdersInput = z.infer<typeof GetErxOrdersInputSchema>;

export interface GetErxOrdersResponse {
  orders: PrescribedMedicationDTO[];
}
