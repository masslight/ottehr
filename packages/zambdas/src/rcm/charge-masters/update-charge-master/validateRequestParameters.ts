import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

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
  name: z.string().min(1),
  effectiveDate: z.string().date(),
  description: z.string().optional(),
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
