import { ZambdaInput } from '../../shared';
import { CreateUserParams } from 'utils';

export function validateRequestParameters(input: ZambdaInput): CreateUserParams & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { email, applicationID, firstName, lastName } = JSON.parse(input.body);

  if (!email || !applicationID || !firstName || !lastName) {
    throw new Error('These fields are required: "email", "applicationID", "firstName", "lastName"');
  }

  return {
    email,
    applicationID,
    firstName,
    lastName,
    secrets: input.secrets,
  };
}
