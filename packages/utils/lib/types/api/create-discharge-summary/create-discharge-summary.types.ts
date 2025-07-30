import { z } from 'zod';
import { Secrets } from '../../../secrets';

export interface CreateDischargeSummaryResponse {
  message: string;
  documentId: string;
}

export const CreateDischargeSummaryInputSchema = z.object({
  appointmentId: z.string().uuid(),
  timezone: z.string().optional(),
});

export type CreateDischargeSummaryInput = z.infer<typeof CreateDischargeSummaryInputSchema>;

export const CreateDischargeSummaryInputValidatedSchema = CreateDischargeSummaryInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
  userToken: z.string(),
});

export type CreateDischargeSummaryInputValidated = z.infer<typeof CreateDischargeSummaryInputValidatedSchema>;
