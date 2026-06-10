import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

const AddProcedureCodeBodySchema = z.object({
  feeScheduleId: z.string().uuid(),
  code: z.string().min(1),
  description: z.string().optional(),
  modifier: z.string().optional(),
  amount: z.number(),
});

export interface AddProcedureCodeParams {
  feeScheduleId: string;
  code: string;
  description: string | undefined;
  modifier: string | undefined;
  amount: number;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): AddProcedureCodeParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { feeScheduleId, code, description, modifier, amount } = safeValidate(
    AddProcedureCodeBodySchema,
    JSON.parse(input.body)
  );

  return {
    feeScheduleId,
    code,
    description: description || undefined,
    modifier: modifier || undefined,
    amount,
    secrets: input.secrets,
  };
}
