import { GetNursingOrdersInputSchema, GetNursingOrdersInputValidated } from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

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
