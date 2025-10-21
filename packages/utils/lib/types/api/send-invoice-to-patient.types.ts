import z from 'zod';

export const SendInvoiceToPatientZambdaInputSchema = z.object({
  patientId: z.string().uuid(),
  candidClaimId: z.string().uuid(),
});
export type SendInvoiceToPatientZambdaInput = z.infer<typeof SendInvoiceToPatientZambdaInputSchema>;
