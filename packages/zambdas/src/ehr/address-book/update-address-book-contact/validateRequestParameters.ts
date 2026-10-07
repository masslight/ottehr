import { AddressBookContactInput, UpdateAddressBookContactInputSchema } from 'utils/lib/types/data/address-book';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export interface UpdateAddressBookContactParams {
  contactId: string;
  contact: AddressBookContactInput;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): UpdateAddressBookContactParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  const { contactId, ...contact } = safeValidate(UpdateAddressBookContactInputSchema, safeJsonParse(input.body));
  return { contactId, contact, secrets: input.secrets };
}
