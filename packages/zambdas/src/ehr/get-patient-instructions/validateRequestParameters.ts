import { GetPatientInstructionsInput, MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const GetPatientInstructionsBodySchema = z.object({
  type: z.enum(['provider', 'organization']),
});

export function validateRequestParameters(
  input: ZambdaInput
): GetPatientInstructionsInput & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body) as unknown;
  const data = safeValidate(GetPatientInstructionsBodySchema, parsed);

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return { ...data, secrets: input.secrets, userToken };
}
