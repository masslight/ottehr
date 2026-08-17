import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export interface CmDeleteProcedureCodeParams {
  chargeMasterId: string;
  index: number;
  secrets: ZambdaInput['secrets'];
}

const CmDeleteProcedureCodeBodySchema = z.object({
  chargeMasterId: z.string().uuid(),
  index: z.number().int().min(0),
});

export function validateRequestParameters(input: ZambdaInput): CmDeleteProcedureCodeParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { chargeMasterId, index } = safeValidate(CmDeleteProcedureCodeBodySchema, safeJsonParse(input.body));

  return {
    chargeMasterId,
    index,
    secrets: input.secrets,
  };
}
