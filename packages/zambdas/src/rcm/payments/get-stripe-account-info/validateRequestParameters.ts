import { Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface GetStripeAccountInfoInput {
  stripeAccountId: string;
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): GetStripeAccountInfoInput {
  const parsed = typeof input.body === 'string' ? JSON.parse(input.body) : input.body;
  const stripeAccountId = parsed?.stripeAccountId;

  if (!stripeAccountId || typeof stripeAccountId !== 'string') {
    throw new Error('stripeAccountId is required');
  }

  return {
    stripeAccountId,
    secrets: input.secrets,
  };
}
