import { Secrets } from 'utils/lib/secrets';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { getUserToken } from '../../shared/auth';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const OpenEmployeeChatSchema = z.object({
  targetProfile: z
    .string()
    .regex(/^Practitioner\/[A-Za-z0-9\-.]{1,64}$/, 'targetProfile must be a Practitioner reference'),
});

export interface OpenEmployeeChatInputValidated {
  targetProfile: string;
  secrets: Secrets;
  userToken: string;
}

export function validateRequestParameters(input: ZambdaInput): OpenEmployeeChatInputValidated {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  const { targetProfile } = safeValidate(OpenEmployeeChatSchema, safeJsonParse(input.body));
  return { targetProfile, secrets: input.secrets, userToken: getUserToken(input) };
}
