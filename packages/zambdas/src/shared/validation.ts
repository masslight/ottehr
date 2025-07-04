import { ZodError, ZodSchema } from 'zod';
import { fromZodError } from 'zod-validation-error';

// Phone number regex
// ^(\+1)? match an optional +1 at the beginning of the string
// \d{10}$ match exactly 10 digits at the end of the string
export const phoneRegex = /^(\+1)?\d{10}$/;

export function safeValidate<T>(schema: ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const formatted = fromZodError(error);
      console.error('[Validation Error]', formatted.message);
      throw new Error(formatted.message);
    }

    if (error instanceof Error) {
      console.error('[Unknown Validation Error]', error.message);
      throw error;
    }

    console.error('[Unknown Validation Error]', error);
    throw new Error('Unknown validation error');
  }
}
