import z from 'zod';

export const GetPrefilledInvoiceInfoZambdaInputSchema = z.object({
  patientId: z.string().uuid(),
});
export type GetPrefilledInvoiceInfoZambdaInput = z.infer<typeof GetPrefilledInvoiceInfoZambdaInputSchema>;

export const GetPrefilledInvoiceInfoZambdaOutputSchema = z.object({
  recipientName: z.string(),
  recipientEmail: z.string().email(),
  recipientPhoneNumber: z.string(),
  dueDate: z.string(),
  memo: z.string(),
  smsTextMessage: z.string(),
});

export type GetPrefilledInvoiceInfoZambdaOutput = z.infer<typeof GetPrefilledInvoiceInfoZambdaOutputSchema>;
