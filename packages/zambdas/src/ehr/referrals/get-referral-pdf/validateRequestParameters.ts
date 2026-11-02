import { GetReferralPdfInput, GetReferralPdfInputSchema } from 'utils/lib/types/api/referrals/referrals.types';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export type GetReferralPdfParams = GetReferralPdfInput & { secrets: ZambdaInput['secrets'] };

export function validateRequestParameters(input: ZambdaInput): GetReferralPdfParams {
  const params = safeValidate(GetReferralPdfInputSchema, safeJsonParse(input.body ?? ''));
  return { ...params, secrets: input.secrets };
}
