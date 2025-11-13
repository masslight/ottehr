import z from 'zod';

export const PrefilledInvoiceInfoSchema = z.object({
  recipientName: z.string(),
  recipientEmail: z.string(),
  recipientPhoneNumber: z.string(),
  dueDate: z.string(),
  memo: z.string().optional(),
  smsTextMessage: z.string(),
});
export type PrefilledInvoiceInfo = z.infer<typeof PrefilledInvoiceInfoSchema>;

export const UpdateInvoiceTaskZambdaInputSchema = z.object({
  taskId: z.string().uuid(),
  status: z.string(),
  prefilledInvoiceInfo: PrefilledInvoiceInfoSchema,
});
export type UpdateInvoiceTaskZambdaInput = z.infer<typeof UpdateInvoiceTaskZambdaInputSchema>;
