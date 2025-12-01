import z from 'zod';

export const PrefilledInvoiceInfoSchema = z.object({
  patientFullName: z.string(),
  patientDob: z.string(),
  patientGender: z.string(),
  patientPhoneNumber: z.string(),
  responsiblePartyName: z.string(), // todo, check different variants of responsible party, self, spose ...
  responsiblePartyPhoneNumber: z.string(), // todo and what data and where will be stored
  responsiblePartyEmail: z.string().optional(),
  dueDate: z.string(),
  memo: z.string().optional(),
  smsTextMessage: z.string(),
  amountCents: z.number(),
});
export type PrefilledInvoiceInfo = z.infer<typeof PrefilledInvoiceInfoSchema>;

export const UpdateInvoiceTaskZambdaInputSchema = z.object({
  taskId: z.string().uuid(),
  status: z.string(),
  prefilledInvoiceInfo: PrefilledInvoiceInfoSchema,
});
export type UpdateInvoiceTaskZambdaInput = z.infer<typeof UpdateInvoiceTaskZambdaInputSchema>;

export type InvoiceMessagesPlaceholders = {
  clinic?: string;
  amount?: string;
  'due-date'?: string;
  'invoice-link'?: string;
};
