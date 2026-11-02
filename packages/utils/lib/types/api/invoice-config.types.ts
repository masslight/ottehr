import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { z } from 'zod';
import { INVOICE_ISSUER_SOURCES } from '../constants';

const DUE_DAYS_MESSAGE = 'dueDaysFromGeneration must be an integer between 1 and 365';

export const SaveInvoiceConfigBodySchema = z.object({
  dueDaysFromGeneration: z
    .number({ invalid_type_error: DUE_DAYS_MESSAGE })
    .int(DUE_DAYS_MESSAGE)
    .min(1, DUE_DAYS_MESSAGE)
    .max(365, DUE_DAYS_MESSAGE),
  defaultSmsTemplate: z
    .string({ invalid_type_error: 'defaultSmsTemplate must be a non-empty string' })
    .refine((value) => value.trim().length > 0, 'defaultSmsTemplate must be a non-empty string'),
  defaultInvoiceMemo: z
    .string({ invalid_type_error: 'defaultInvoiceMemo must be a non-empty string' })
    .refine((value) => value.trim().length > 0, 'defaultInvoiceMemo must be a non-empty string'),
  // Omitted by callers that don't manage it (the EHR); the stored setting is kept.
  invoiceIssuerSource: z.enum(INVOICE_ISSUER_SOURCES).optional(),
});

export type SaveInvoiceConfigInput = z.infer<typeof SaveInvoiceConfigBodySchema>;

export interface InvoiceConfigResponse {
  questionnaire: Questionnaire;
  questionnaireResponse: QuestionnaireResponse;
}
