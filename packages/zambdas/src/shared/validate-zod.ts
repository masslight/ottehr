import { captureException } from '@sentry/aws-serverless';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { z } from 'zod';
import { ZambdaInput } from './types/common';

const formatIssues = (error: z.ZodError): string =>
  error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');

// Validate a zambda request body against the endpoint's Zod input schema — the same schema that
// derives the endpoint's TS input type, so the contract cannot drift from the validation.
export function validateWithSchema<T>(schema: z.ZodType<T>, input: ZambdaInput): T & { secrets: Secrets } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }
  let body: unknown;
  try {
    body = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('request body is not valid JSON');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw INVALID_INPUT_ERROR(formatIssues(parsed.error));
  }
  return { ...parsed.data, secrets: input.secrets };
}

// Validate a zambda RESPONSE against the endpoint's Zod output schema before it leaves the zambda.
// The schema is the endpoint's single source of truth — what the zambda returns MUST match what the
// LLM was told about the rows — so a mapper drift fails loud at the source (with a server-side log)
// instead of surfacing as a client-side parse error. Returns the parsed value, so unknown extra
// fields are stripped and exactly the contract is what ships.
export function validateOutputWithSchema<T>(schema: z.ZodType<T>, output: unknown, endpoint: string): T {
  const parsed = schema.safeParse(output);
  if (!parsed.success) {
    const issues = formatIssues(parsed.error);
    const error = new Error(`${endpoint} produced a response that does not match its schema (${issues})`);
    console.error(error.message);
    captureException(error);
    throw error;
  }
  return parsed.data;
}
