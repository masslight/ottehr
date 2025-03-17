import { GetUserParams, WithRequired } from 'utils';
import { Secrets } from 'zambda-utils';
import { ZambdaInput } from 'zambda-utils';

export interface GetUserInput extends WithRequired<GetUserParams, 'userId'> {
  secrets: Secrets | null;
}

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
