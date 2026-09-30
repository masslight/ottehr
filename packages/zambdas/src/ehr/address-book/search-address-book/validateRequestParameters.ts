import { SearchAddressBookInput, SearchAddressBookInputSchema } from 'utils/lib/types/data/address-book';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export type SearchAddressBookParams = SearchAddressBookInput & { secrets: ZambdaInput['secrets'] };

export function validateRequestParameters(input: ZambdaInput): SearchAddressBookParams {
  const { tag } = safeValidate(SearchAddressBookInputSchema, input.body ? safeJsonParse(input.body) : {});
  return { tag, secrets: input.secrets };
}
