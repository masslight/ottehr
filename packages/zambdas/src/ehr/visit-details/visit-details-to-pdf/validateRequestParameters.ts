import { VisitDetailsInputSchema, VisitDetailsInputValidated, VisitDetailsInputValidatedSchema } from 'utils';
import { ZodError } from 'zod';
import { formatZodError, ZambdaInput } from '../../../shared';

export function validateRequestParameters(input: ZambdaInput): VisitDetailsInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (!input.headers?.Authorization) {
    throw new Error('Authorization header is required');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw new Error('Invalid JSON in request body.');
  }

  try {
    const validatedCore = VisitDetailsInputSchema.parse(parsed);

    const validated = VisitDetailsInputValidatedSchema.parse({
      ...validatedCore,
      secrets: input.secrets,
      userToken,
    });

    console.groupEnd();
    console.debug('validateRequestParameters success');

    return validated;
  } catch (err) {
    console.groupEnd();

    if (err instanceof ZodError) {
      throw new Error(`Invalid request parameters: ${formatZodError(err)}`);
    }
    throw err;
  }
}
