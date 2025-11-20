import { z } from 'zod';
import { Secrets } from '../../../secrets';

export interface VisitDetailsResponse {
  documentReference: string;
}

export const VisitDetailsInputSchema = z.object({
  appointmentId: z.string().uuid(),
  timezone: z.string().optional(),
});

export type VisitDetailsInput = z.infer<typeof VisitDetailsInputSchema>;

export const VisitDetailsInputValidatedSchema = VisitDetailsInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
  userToken: z.string(),
});

export type VisitDetailsInputValidated = z.infer<typeof VisitDetailsInputValidatedSchema>;
