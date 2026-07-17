import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

const DeleteProcedureCodeBodySchema = z.object({
  feeScheduleId: z.string().uuid(),
  index: z.number().int().min(0),
});

export interface DeleteProcedureCodeParams {
  feeScheduleId: string;
  index: number;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DeleteProcedureCodeParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { feeScheduleId, index } = safeValidate(DeleteProcedureCodeBodySchema, safeJsonParse(input.body));

  return {
    feeScheduleId,
    index,
    secrets: input.secrets,
  };
}
