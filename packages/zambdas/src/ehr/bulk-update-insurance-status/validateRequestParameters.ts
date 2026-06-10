import { BulkUpdateInsuranceStatusInput, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const BulkUpdateInsuranceStatusBodySchema = z.object({
  insuranceIds: z.array(z.string().uuid()).min(1),
  active: z.boolean(),
});

export function validateRequestParameters(input: ZambdaInput): BulkUpdateInsuranceStatusInput & { secrets: Secrets } {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = JSON.parse(input.body);
  const { insuranceIds, active } = safeValidate(BulkUpdateInsuranceStatusBodySchema, parsed);

  return {
    insuranceIds,
    active,
    secrets: input.secrets,
  };
}
