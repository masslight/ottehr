import { AddressBookContactInput, AddressBookContactInputSchema } from 'utils/lib/types/data/address-book';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export interface CreateAddressBookContactParams {
  contact: AddressBookContactInput;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CreateAddressBookContactParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  const contact = safeValidate(AddressBookContactInputSchema, safeJsonParse(input.body));
  return { contact, secrets: input.secrets };
}
