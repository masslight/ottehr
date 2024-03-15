import { ZambdaInput } from '../types';
import { GetUserInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetUserInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { userId } = JSON.parse(input.body);

  if (
    userId === undefined
    // locations === undefined ||
    // locations.length === 0
  ) {
    throw new Error('These fields are required: "userId"');
  }

  return {
    userId,
    secrets: input.secrets,
  };
}
