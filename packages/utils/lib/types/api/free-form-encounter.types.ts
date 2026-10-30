import { z } from 'zod';
import { FreeFormEncounterHistoryRow } from './patient-visit-history.types';

export const SaveFreeFormEncounterInputSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  note: z.string().trim().min(1, 'note must not be empty'),
});
export type SaveFreeFormEncounterInput = z.infer<typeof SaveFreeFormEncounterInputSchema>;

export type SaveFreeFormEncounterOutput = FreeFormEncounterHistoryRow;
