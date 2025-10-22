import z from 'zod';

export const GetPrefilledInvoiceInfoZambdaInputSchema = z.object({
  patientId: z.string().uuid(),
});
export type GetPrefilledInvoiceInfoZambdaInput = z.infer<typeof GetPrefilledInvoiceInfoZambdaInputSchema>;

export const GetPrefilledInvoiceInfoZambdaOutputSchema = z.object({
  responsiblePartyName: z.string(),
  responsiblePartyEmail: z.string().email(),
  responsiblePartyPhoneNumber: z.string(),
  dueDate: z.string().optional(),
  memo: z.string().optional(),
  smsTextMessage: z.string().optional(),
});

export type GetPrefilledInvoiceInfoZambdaOutput = z.infer<typeof GetPrefilledInvoiceInfoZambdaOutputSchema>;
