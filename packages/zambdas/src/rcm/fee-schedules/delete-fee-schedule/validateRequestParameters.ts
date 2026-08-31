import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const DeleteFeeScheduleBodySchema = z.object({
  id: z.string().uuid(),
});

export interface DeleteFeeScheduleParams {
  id: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DeleteFeeScheduleParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { id } = safeValidate(DeleteFeeScheduleBodySchema, safeJsonParse(input.body));

  return {
    id,
    secrets: input.secrets,
  };
}
