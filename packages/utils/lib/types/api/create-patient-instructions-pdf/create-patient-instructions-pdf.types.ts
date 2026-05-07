import { z } from 'zod';
import { Secrets } from '../../../secrets';

export interface CreatePatientInstructionsPdfResponse {
  message: string;
  documentId: string;
}

export const CreatePatientInstructionsPdfInputSchema = z.object({
  appointmentId: z.string().uuid(),
});

export type CreatePatientInstructionsPdfInput = z.infer<typeof CreatePatientInstructionsPdfInputSchema>;

export const CreatePatientInstructionsPdfInputValidatedSchema = CreatePatientInstructionsPdfInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
  userToken: z.string(),
});

export type CreatePatientInstructionsPdfInputValidated = z.infer<
  typeof CreatePatientInstructionsPdfInputValidatedSchema
>;
