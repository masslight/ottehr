import z from 'zod';

export const SendInvoiceToPatientZambdaInputSchema = z.object({
  oystPatientId: z.string().uuid(),
  oystEncounterId: z.string().uuid(),
  // prefilledInfo: GetPrefilledInvoiceInfoZambdaOutputSchema,
});
export type SendInvoiceToPatientZambdaInput = z.infer<typeof SendInvoiceToPatientZambdaInputSchema>;
