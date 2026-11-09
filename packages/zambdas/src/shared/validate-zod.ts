import { captureException } from '@sentry/node-core/light';
import { z } from 'zod';

const formatIssues = (error: z.ZodError): string =>
  error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');

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
