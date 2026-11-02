import { SaveReferralInput, SaveReferralInputSchema } from 'utils/lib/types/api/referrals/referrals.types';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export type SaveReferralParams = SaveReferralInput & { secrets: ZambdaInput['secrets'] };

export function validateRequestParameters(input: ZambdaInput): SaveReferralParams {
  const params = safeValidate(SaveReferralInputSchema, safeJsonParse(input.body ?? ''));
  return { ...params, secrets: input.secrets };
}
