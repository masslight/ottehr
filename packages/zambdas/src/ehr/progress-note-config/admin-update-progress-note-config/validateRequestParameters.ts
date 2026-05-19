import {
  AdminUpdateProgressNoteConfigInput,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  ProgressNoteConfigSchema,
  Secrets,
} from 'utils';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared';

const validationSchema = z.object({
  config: ProgressNoteConfigSchema,
});

export function validateRequestParameters(
  input: ZambdaInput
): AdminUpdateProgressNoteConfigInput & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: AdminUpdateProgressNoteConfigInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const validatedParsed = validationSchema.safeParse(params);
  if (!validatedParsed.success) {
    throw INVALID_INPUT_ERROR(`Validation failed: ${JSON.stringify(validatedParsed.error.errors)}`);
  }

  return {
    config: validatedParsed.data.config as AdminUpdateProgressNoteConfigInput['config'],
    secrets,
    userToken,
  };
}
