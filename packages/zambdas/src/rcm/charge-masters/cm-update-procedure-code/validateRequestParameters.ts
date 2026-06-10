import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

export interface CmUpdateProcedureCodeParams {
  chargeMasterId: string;
  index: number;
  code: string;
  description: string | undefined;
  modifier: string | undefined;
  amount: number;
  secrets: ZambdaInput['secrets'];
}

const CmUpdateProcedureCodeBodySchema = z.object({
  chargeMasterId: z.string().uuid(),
  index: z.number().int().min(0),
  code: z.string().min(1),
  description: z.string().min(1).optional(),
  modifier: z.string().min(1).optional(),
  amount: z.number(),
});

export function validateRequestParameters(input: ZambdaInput): CmUpdateProcedureCodeParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { chargeMasterId, index, code, description, modifier, amount } = safeValidate(
    CmUpdateProcedureCodeBodySchema,
    JSON.parse(input.body)
  );

  return {
    chargeMasterId,
    index,
    code,
    description: description || undefined,
    modifier: modifier || undefined,
    amount,
    secrets: input.secrets,
  };
}
