import { INVALID_INPUT_ERROR } from 'utils';
import { z, ZodError, ZodSchema } from 'zod';
import { fromZodError } from 'zod-validation-error';

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

export function formatZodError(err: ZodError): string {
  return err.errors.map((e) => `${e.path.length ? e.path.join('.') : '(root)'}: ${e.message}`).join('; ');
}
