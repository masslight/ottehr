import {
  UpdateReferralStatusInput,
  UpdateReferralStatusInputSchema,
} from 'utils/lib/types/api/referrals/referrals.types';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export type UpdateReferralStatusParams = UpdateReferralStatusInput & { secrets: ZambdaInput['secrets'] };

export function validateRequestParameters(input: ZambdaInput): UpdateReferralStatusParams {
  const params = safeValidate(UpdateReferralStatusInputSchema, safeJsonParse(input.body ?? ''));
  return { ...params, secrets: input.secrets };
}
