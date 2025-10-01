import z from 'zod';

export const SendReceiptByEmailZambdaInputSchema = z.object({
  recipientFullName: z.string(),
  email: z.string(),
  receiptDocRefId: z.string().uuid(),
});
export type SendReceiptByEmailZambdaInput = z.infer<typeof SendReceiptByEmailZambdaInputSchema>;

export type SendReceiptByEmailZambdaOutput = Record<string, string>;
