import { ListReferralsInput, ListReferralsInputSchema } from 'utils/lib/types/api/referrals/referrals.types';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export type ListReferralsParams = ListReferralsInput & { secrets: ZambdaInput['secrets'] };

export function validateRequestParameters(input: ZambdaInput): ListReferralsParams {
  const params = safeValidate(ListReferralsInputSchema, safeJsonParse(input.body ?? ''));
  return { ...params, secrets: input.secrets };
}
