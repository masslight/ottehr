import { ReceiveMedicationShipmentInputSchema } from 'utils/lib/types/api/config/in-house-medications';
import { MISSING_AUTH_TOKEN } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../../../shared/validation';

export function validateRequestParameters(
  input: ZambdaInput
): ValidatedZambdaInput<typeof ReceiveMedicationShipmentInputSchema> & { userToken: string } {
  const userToken = input.headers?.Authorization?.replace('Bearer ', '');
  if (!userToken) throw MISSING_AUTH_TOKEN;
  return { ...validateWithSchema(ReceiveMedicationShipmentInputSchema, input), userToken };
}
