import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { Secrets } from 'utils/lib/secrets';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';
import { validateJsonBody } from '../../../shared/helpers';

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
