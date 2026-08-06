import { BulkUpdateInsuranceStatusInput } from 'utils/lib/types/api/bulk-update-insurance-status.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { Secrets } from 'utils/lib/secrets';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

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

  const parsed = safeJsonParse(input.body);
  const { insuranceIds, active } = safeValidate(BulkUpdateInsuranceStatusBodySchema, parsed);

  return {
    insuranceIds,
    active,
    secrets: input.secrets,
  };
}
