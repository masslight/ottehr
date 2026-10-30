import { GetMedicationInventoryInputSchema } from 'utils/lib/types/api/config/in-house-medications';
import { ZambdaInput } from '../../../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../../../shared/validation';

export function validateRequestParameters(
  input: ZambdaInput
): ValidatedZambdaInput<typeof GetMedicationInventoryInputSchema> {
  return validateWithSchema(GetMedicationInventoryInputSchema, input);
}
