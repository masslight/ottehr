import z from 'zod';
import { GetPrefilledInvoiceInfoZambdaOutputSchema } from './get-prefilled-invoice-info.types';

export const SendInvoiceToPatientZambdaInputSchema = z.object({
  oystPatientId: z.string().uuid(),
  oystEncounterId: z.string().uuid(),
  prefilledInfo: GetPrefilledInvoiceInfoZambdaOutputSchema,
});
export type SendInvoiceToPatientZambdaInput = z.infer<typeof SendInvoiceToPatientZambdaInputSchema>;
