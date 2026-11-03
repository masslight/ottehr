import { isPhoneNumberValid } from 'utils/lib/helpers/helpers';
import { SaveReferralInput, SaveReferralInputSchema } from 'utils/lib/types/api/referrals/referrals.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export type SaveReferralParams = SaveReferralInput & { secrets: ZambdaInput['secrets'] };

export function validateRequestParameters(input: ZambdaInput): SaveReferralParams {
  const params = safeValidate(SaveReferralInputSchema, safeJsonParse(input.body ?? ''));
  // The typed fax is printed on the form and dialled by the fax packet. The form checks it in the browser;
  // this is the same check send-fax-packet applies, so a direct call cannot store junk.
  if (params.recipientFax && !isPhoneNumberValid(params.recipientFax)) {
    throw INVALID_INPUT_ERROR(`"${params.recipientFax}" is not a valid fax number`);
  }
  return { ...params, secrets: input.secrets };
}
