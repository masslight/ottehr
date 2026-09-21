import { DeleteAddressBookContactInput, DeleteAddressBookContactInputSchema } from 'utils/lib/types/data/address-book';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export type DeleteAddressBookContactParams = DeleteAddressBookContactInput & { secrets: ZambdaInput['secrets'] };

export function validateRequestParameters(input: ZambdaInput): DeleteAddressBookContactParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  const { contactId } = safeValidate(DeleteAddressBookContactInputSchema, safeJsonParse(input.body));
  return { contactId, secrets: input.secrets };
}
