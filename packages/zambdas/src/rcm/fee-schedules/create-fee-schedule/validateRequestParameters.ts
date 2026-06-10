import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

const CreateFeeScheduleBodySchema = z.object({
  name: z.string().min(1),
  effectiveDate: z.string().min(1),
  description: z.string().optional(),
});

export interface CreateFeeScheduleParams {
  name: string;
  effectiveDate: string;
  description: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CreateFeeScheduleParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { name, effectiveDate, description } = safeValidate(CreateFeeScheduleBodySchema, JSON.parse(input.body));

  return {
    name,
    effectiveDate,
    description: description ?? '',
    secrets: input.secrets,
  };
}
