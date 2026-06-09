import z from 'zod';
import { PrescribedMedicationDTO } from './chart-data';

export const GetErxOrdersInputSchema = z.object({
  encounterIds: z.array(z.string()),
});

export type GetErxOrdersInput = z.infer<typeof GetErxOrdersInputSchema>;

export interface GetErxOrdersResponse {
  orders: PrescribedMedicationDTO[];
}

export const TagEncounterErxSyncedInputSchema = z.object({
  encounterId: z.string().min(1),
});

export type TagEncounterErxSyncedInput = z.infer<typeof TagEncounterErxSyncedInputSchema>;

export interface TagEncounterErxSyncedResponse {
  tagged: boolean;
}
