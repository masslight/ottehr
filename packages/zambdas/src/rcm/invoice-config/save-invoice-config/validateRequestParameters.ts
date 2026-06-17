import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

export interface SaveInvoiceConfigInput {
  dueDaysFromGeneration: number;
  defaultSmsTemplate: string;
  defaultInvoiceMemo: string;
  secrets: Record<string, string>;
}

const DUE_DAYS_MESSAGE = 'dueDaysFromGeneration must be an integer between 1 and 365';

const SaveInvoiceConfigBodySchema = z.object({
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

export function validateRequestParameters(input: ZambdaInput): SaveInvoiceConfigInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const { dueDaysFromGeneration, defaultSmsTemplate, defaultInvoiceMemo } = safeValidate(
    SaveInvoiceConfigBodySchema,
    safeJsonParse(input.body)
  );

  return {
    dueDaysFromGeneration,
    defaultSmsTemplate,
    defaultInvoiceMemo,
    secrets: input.secrets,
  };
}
