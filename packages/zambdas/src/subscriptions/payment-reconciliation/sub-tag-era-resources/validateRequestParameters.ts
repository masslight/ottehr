import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { z } from 'zod';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../../shared';

export interface TagEraResourcesInput {
  paymentReconciliationId: string;
  secrets: Secrets;
}

const PaymentReconciliationBodySchema = z
  .object({
    resourceType: z.literal('PaymentReconciliation'),
    id: z.string().min(1),
  })
  .passthrough();

export function validateRequestParameters(input: ZambdaInput): TagEraResourcesInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const paymentReconciliation = safeValidate(PaymentReconciliationBodySchema, validateJsonBody(input));

  return {
    paymentReconciliationId: paymentReconciliation.id,
    secrets: input.secrets,
  };
}
