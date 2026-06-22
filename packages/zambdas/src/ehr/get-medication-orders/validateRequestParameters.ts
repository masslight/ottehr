import { GetMedicationOrdersInput, GetMedicationOrdersInputSchema, MISSING_REQUEST_BODY } from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GetMedicationOrdersInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsedJSON = JSON.parse(input.body) as unknown;
  const { searchBy } = safeValidate(GetMedicationOrdersInputSchema, parsedJSON);
  console.log('parsed searchBy', JSON.stringify(searchBy));

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    searchBy,
    secrets: input.secrets,
  };
}
