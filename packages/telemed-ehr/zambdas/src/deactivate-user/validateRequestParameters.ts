import { ZambdaInput } from '../types';
import { DeactivateUserInput } from '.';

export function validateRequestParameters(input: ZambdaInput): DeactivateUserInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { user } = JSON.parse(input.body);

  if (
    user === undefined
    // locations === undefined ||
    // locations.length === 0
  ) {
    throw new Error('These fields are required: "user"');
  }

  return {
    user,
    // locations,
    secrets: input.secrets,
  };
}
