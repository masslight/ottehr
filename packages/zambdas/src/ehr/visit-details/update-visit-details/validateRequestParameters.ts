import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  NOT_AUTHORIZED,
  Secrets,
  UpdateVisitDetailsRequest,
  UpdateVisitDetailsRequestSchema,
} from 'utils';
import { ZodError } from 'zod';
import { ZambdaInput } from '../../../shared';
import { formatZodError } from '../../../shared/validation';

export interface UpdateVisitDetailsValidatedInput extends UpdateVisitDetailsRequest {
  secrets: Secrets | null;
  userToken: string;
}

export const validateRequestParameters = (input: ZambdaInput): UpdateVisitDetailsValidatedInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization?.replace('Bearer ', '');
  if (!userToken) {
    throw NOT_AUTHORIZED;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('request body must be valid JSON');
  }

  let request: UpdateVisitDetailsRequest;
  try {
    request = UpdateVisitDetailsRequestSchema.parse(parsed);
  } catch (err) {
    if (err instanceof ZodError) {
      throw INVALID_INPUT_ERROR(formatZodError(err));
    }
    throw err;
  }

  return {
    ...request,
    secrets: input.secrets,
    userToken,
  };
};
