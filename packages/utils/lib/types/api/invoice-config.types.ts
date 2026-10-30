import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { z } from 'zod';

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
});

export type SaveInvoiceConfigInput = z.infer<typeof SaveInvoiceConfigBodySchema>;

export interface InvoiceConfigResponse {
  questionnaire: Questionnaire;
  questionnaireResponse: QuestionnaireResponse;
  // Set by the get endpoints from the INVOICING_IN_BILLING_APP secret, so both apps follow it without a rebuild.
  invoicingInBillingApp?: boolean;
}
