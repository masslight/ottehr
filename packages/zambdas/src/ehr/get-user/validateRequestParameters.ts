import { Secrets } from 'utils/lib/secrets';
import { GetUserParams } from 'utils/lib/types/api/get-user.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { WithRequired } from 'utils/lib/types/utils';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

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

  const { userId } = safeValidate(GetUserBodySchema, safeJsonParse(input.body));

  return {
    userId,
    secrets: input.secrets,
  };
}
