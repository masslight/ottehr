import { z } from 'zod';

export const CreateReceiptZambdaInputSchema = z.object({
  encounterId: z.string().uuid(),
  patientId: z.string().uuid(),
});

export const CreateReceiptZambdaOutputSchema = z.object({
  pdfUrl: z.string(),
});

export type CreateReceiptZambdaInput = z.infer<typeof CreateReceiptZambdaInputSchema>;

export type CreateReceiptZambdaOutput = z.infer<typeof CreateReceiptZambdaOutputSchema>;
