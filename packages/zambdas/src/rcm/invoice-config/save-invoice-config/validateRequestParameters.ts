import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface SaveInvoiceConfigInput {
  dueDaysFromGeneration: number;
  defaultSmsTemplate: string;
  defaultInvoiceMemo: string;
  secrets: Record<string, string>;
}

export function validateRequestParameters(input: ZambdaInput): SaveInvoiceConfigInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsed = JSON.parse(input.body);

  const { dueDaysFromGeneration, defaultSmsTemplate, defaultInvoiceMemo } = parsed;

  if (!Number.isInteger(dueDaysFromGeneration) || dueDaysFromGeneration < 1 || dueDaysFromGeneration > 365) {
    throw INVALID_INPUT_ERROR('dueDaysFromGeneration must be an integer between 1 and 365');
  }

  if (typeof defaultSmsTemplate !== 'string' || defaultSmsTemplate.trim().length === 0) {
    throw INVALID_INPUT_ERROR('defaultSmsTemplate must be a non-empty string');
  }

  if (typeof defaultInvoiceMemo !== 'string' || defaultInvoiceMemo.trim().length === 0) {
    throw INVALID_INPUT_ERROR('defaultInvoiceMemo must be a non-empty string');
  }

  return {
    dueDaysFromGeneration,
    defaultSmsTemplate,
    defaultInvoiceMemo,
    secrets: input.secrets,
  };
}
