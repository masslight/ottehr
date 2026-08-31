import { CreateUserParams } from 'utils/lib/types/api/create-user.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

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
