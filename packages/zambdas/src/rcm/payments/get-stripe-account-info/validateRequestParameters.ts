import { MISSING_REQUIRED_PARAMETERS, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface GetStripeAccountInfoInput {
  stripeAccountId: string;
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): GetStripeAccountInfoInput {
  const parsed = typeof input.body === 'string' ? JSON.parse(input.body) : input.body;
  const stripeAccountId = parsed?.stripeAccountId;

  if (!stripeAccountId || typeof stripeAccountId !== 'string') {
    throw MISSING_REQUIRED_PARAMETERS(['stripeAccountId']);
  }

  return {
    stripeAccountId,
    secrets: input.secrets,
  };
}
