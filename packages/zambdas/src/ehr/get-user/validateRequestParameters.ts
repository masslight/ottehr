import { GetUserParams, MISSING_REQUEST_BODY, Secrets, WithRequired } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

export interface GetUserInput extends WithRequired<GetUserParams, 'userId'> {
  secrets: Secrets | null;
}

const GetUserBodySchema = z.object({
  userId: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): GetUserInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { userId } = safeValidate(GetUserBodySchema, JSON.parse(input.body));

  return {
    userId,
    secrets: input.secrets,
  };
}
