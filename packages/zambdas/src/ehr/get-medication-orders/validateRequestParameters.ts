import { GetMedicationOrdersInput, GetMedicationOrdersInputSchema } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GetMedicationOrdersInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedJSON = JSON.parse(input.body) as unknown;
  const { searchBy } = GetMedicationOrdersInputSchema.parse(parsedJSON);
  console.log('parsed searchBy', JSON.stringify(searchBy));

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    searchBy,
    secrets: input.secrets,
  };
}
