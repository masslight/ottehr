import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

export interface UpdateFeeScheduleParams {
  id: string;
  name: string;
  effectiveDate?: string;
  description: string;
  status?: 'active' | 'retired';
  designation?: 'case-rate' | null;
  caseRateAmount?: number;
  caseRateComment?: string;
  secrets: ZambdaInput['secrets'];
}

const UpdateFeeScheduleBodySchema = z.object({
  feeScheduleId: z.string().uuid(),
  name: z.string().min(1),
  effectiveDate: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'retired']).optional(),
  designation: z.union([z.literal('case-rate'), z.null()]).optional(),
  caseRateAmount: z.number().min(0).optional(),
  caseRateComment: z.string().optional(),
});

export function validateRequestParameters(input: ZambdaInput): UpdateFeeScheduleParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { feeScheduleId, name, effectiveDate, description, status, designation, caseRateAmount, caseRateComment } =
    safeValidate(UpdateFeeScheduleBodySchema, JSON.parse(input.body));

  return {
    id: feeScheduleId,
    name,
    effectiveDate: effectiveDate || undefined,
    description: description ?? '',
    status,
    designation,
    caseRateAmount,
    caseRateComment: caseRateComment ?? undefined,
    secrets: input.secrets,
  };
}
