import { z } from 'zod';
import { stripeAccountIdRegex } from '../../../validation/regex';

export const StripeWebhookSigningSecretsSchema = z.array(
  z.object({
    name: z.string().optional(),
    accountId: z.string().trim().regex(stripeAccountIdRegex).optional(),
    signingSecret: z.string().trim().min(1),
  })
);
