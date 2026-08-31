import { Secrets } from 'utils/lib/secrets';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export interface GetStripeAccountInfoInput {
  stripeAccountId: string;
  secrets: Secrets | null;
}

const GetStripeAccountInfoBodySchema = z.object({
  stripeAccountId: z.string().min(1),
});

export function validateRequestParameters(input: ZambdaInput): GetStripeAccountInfoInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { stripeAccountId } = safeValidate(GetStripeAccountInfoBodySchema, safeJsonParse(input.body));

  return {
    stripeAccountId,
    secrets: input.secrets,
  };
}
