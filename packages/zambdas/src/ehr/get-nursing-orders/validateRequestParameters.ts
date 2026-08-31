import { GetNursingOrdersInputSchema, GetNursingOrdersInputValidated } from 'utils/lib/types/data/orders/types';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): GetNursingOrdersInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedJSON = safeJsonParse(input.body) as unknown;

  const { searchBy } = safeValidate(GetNursingOrdersInputSchema, parsedJSON);

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    searchBy,
    secrets: input.secrets,
  };
}
