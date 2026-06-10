import { MISSING_REQUEST_BODY, Secrets } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

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

  const { stripeAccountId } = safeValidate(GetStripeAccountInfoBodySchema, JSON.parse(input.body));

  return {
    stripeAccountId,
    secrets: input.secrets,
  };
}
