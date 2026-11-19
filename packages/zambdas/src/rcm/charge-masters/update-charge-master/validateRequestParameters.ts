import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { optionalTextSchema, requiredTextSchema } from 'utils/lib/types/text-schemas';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export interface UpdateChargeMasterParams {
  id: string;
  name: string;
  effectiveDate: string;
  description: string;
  status?: 'active' | 'retired';
  secrets: ZambdaInput['secrets'];
}

const bodySchema = z.object({
  chargeMasterId: z.string().uuid(),
  name: requiredTextSchema,
  effectiveDate: z.string().date(),
  description: optionalTextSchema,
  status: z.enum(['active', 'retired']).optional(),
});

export function validateRequestParameters(input: ZambdaInput): UpdateChargeMasterParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { chargeMasterId, name, effectiveDate, description, status } = safeValidate(bodySchema, parsed);

  return {
    id: chargeMasterId,
    name,
    effectiveDate,
    description: description ?? '',
    status,
    secrets: input.secrets,
  };
}
