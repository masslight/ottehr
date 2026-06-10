import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

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

  const { chargeMasterId, index } = safeValidate(CmDeleteProcedureCodeBodySchema, JSON.parse(input.body));

  return {
    chargeMasterId,
    index,
    secrets: input.secrets,
  };
}
