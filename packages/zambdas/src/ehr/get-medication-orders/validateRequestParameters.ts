import {
  GetMedicationOrdersInput,
  GetMedicationOrdersInputSchema,
} from 'utils/lib/types/api/medication-administration.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): GetMedicationOrdersInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsedJSON = safeJsonParse(input.body) as unknown;
  const { searchBy } = safeValidate(GetMedicationOrdersInputSchema, parsedJSON);
  console.log('parsed searchBy', JSON.stringify(searchBy));

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    searchBy,
    secrets: input.secrets,
  };
}
