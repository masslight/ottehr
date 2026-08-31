import { MISSING_REQUEST_BODY, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { CreateResourcesFromAudioRecordingInputValidated } from '.';

const Z3_URL_PREFIX = 'https://project-api.zapehr.com';

const CreateResourcesFromAudioRecordingBodySchema = z.object({
  z3URL: z
    .string()
    .min(1)
    .startsWith(Z3_URL_PREFIX, {
      message: `z3 url must start with ${Z3_URL_PREFIX}`,
    }),
  visitID: z.string().uuid(),
  duration: z.number().optional(),
});

export function validateRequestParameters(input: ZambdaInput): CreateResourcesFromAudioRecordingInputValidated {
  if (!input.headers?.Authorization) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  const parsed = safeJsonParse(input.body);
  const { visitID, duration, z3URL } = safeValidate(CreateResourcesFromAudioRecordingBodySchema, parsed);

  return {
    userToken,
    duration,
    z3URL,
    visitID,
    secrets: input.secrets,
  };
}
