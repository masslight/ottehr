import { CreateUserParams } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const CreateUserBodySchema = z.object({
  email: z.string().min(1),
  applicationID: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export function validateRequestParameters(input: ZambdaInput): CreateUserParams & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { email, applicationID, firstName, lastName } = safeValidate(CreateUserBodySchema, JSON.parse(input.body));

  return {
    email,
    applicationID,
    firstName,
    lastName,
    secrets: input.secrets,
  };
}
