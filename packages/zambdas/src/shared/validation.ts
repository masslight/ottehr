import { Secrets } from 'utils/lib/secrets';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z, ZodError, ZodSchema, ZodTypeAny } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { ZambdaInput } from './types/common';

// Phone number regex
// ^(\+1)? match an optional +1 at the beginning of the string
// \d{10}$ match exactly 10 digits at the end of the string
export const phoneRegex = /^(\+1)?\d{10}$/;

export function safeJsonParse(body: string): any {
  try {
    return JSON.parse(body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw INVALID_INPUT_ERROR('Request body is not valid JSON');
    }
    throw error;
  }
}

export function safeValidate<T extends ZodSchema<any>>(schema: T, input: unknown): z.output<T> {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const formatted = fromZodError(error);
      console.error('[Validation Error]', formatted.message);
      throw INVALID_INPUT_ERROR(formatted.message);
    }

    console.error('[Unknown Validation Error]', error);
    throw new Error('Unknown validation error');
  }
}

/** What `validateWithSchema` returns for schema `S`: the parsed request body plus the zambda's secrets. */
export type ValidatedZambdaInput<S extends ZodTypeAny> = z.output<S> & { secrets: Secrets };

// Validate a zambda request body against the endpoint's Zod input schema — the same schema that
// derives the endpoint's TS input type, so the contract cannot drift from the validation. Endpoints
// that need nothing more call this straight from their handler; ones with extra checks (auth
// headers, required secrets, cross-field rules) can build on it in their own validateRequestParameters.
export function validateWithSchema<S extends ZodTypeAny>(schema: S, input: ZambdaInput): ValidatedZambdaInput<S> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  let body: unknown;
  try {
    body = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Invalid JSON in request body');
  }

  return { ...safeValidate(schema, body), secrets: input.secrets };
}

export function formatZodError(err: ZodError): string {
  return err.errors.map((e) => `${e.path.length ? e.path.join('.') : '(root)'}: ${e.message}`).join('; ');
}
