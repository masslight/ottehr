import { ZambdaInput } from '../../../shared';

export interface SaveInvoiceConfigInput {
  dueDaysFromGeneration: number;
  defaultSmsTemplate: string;
  defaultInvoiceMemo: string;
  secrets: Record<string, string>;
}

export function validateRequestParameters(input: ZambdaInput): SaveInvoiceConfigInput {
  if (!input.body) throw new Error('Request body is missing');
  if (!input.secrets) throw new Error('Secrets are not defined');

  const parsed = JSON.parse(input.body);

  const { dueDaysFromGeneration, defaultSmsTemplate, defaultInvoiceMemo } = parsed;

  if (!Number.isInteger(dueDaysFromGeneration) || dueDaysFromGeneration < 1 || dueDaysFromGeneration > 365) {
    throw new Error('dueDaysFromGeneration must be an integer between 1 and 365');
  }

  if (typeof defaultSmsTemplate !== 'string' || defaultSmsTemplate.trim().length === 0) {
    throw new Error('defaultSmsTemplate must be a non-empty string');
  }

  if (typeof defaultInvoiceMemo !== 'string' || defaultInvoiceMemo.trim().length === 0) {
    throw new Error('defaultInvoiceMemo must be a non-empty string');
  }

  return {
    dueDaysFromGeneration,
    defaultSmsTemplate,
    defaultInvoiceMemo,
    secrets: input.secrets,
  };
}
