import { CreateUserParams, MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const CreateUserBodySchema = z.object({
  email: z.string().email(),
  applicationID: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export function validateRequestParameters(input: ZambdaInput): CreateUserParams & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { email, applicationID, firstName, lastName } = safeValidate(CreateUserBodySchema, safeJsonParse(input.body));

  return {
    email,
    applicationID,
    firstName,
    lastName,
    secrets: input.secrets,
  };
}
