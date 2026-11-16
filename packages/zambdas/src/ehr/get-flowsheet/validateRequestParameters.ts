import { GetFlowsheetInputSchema } from 'utils/lib/types/api/flowsheets.types';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';

export type ValidatedGetFlowsheetInput = ValidatedZambdaInput<typeof GetFlowsheetInputSchema>;

export function validateRequestParameters(input: ZambdaInput): ValidatedGetFlowsheetInput {
  return validateWithSchema(GetFlowsheetInputSchema, input);
}
