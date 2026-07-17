import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition } from 'fhir/r4b';
import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  UpdateChargeItemDefinitionInput,
  UpdateChargeItemDefinitionInputSchema,
} from 'utils';
import { ZambdaInput } from '../../shared';
import { safeValidate, validateJsonBody } from '../../shared';
import { getChargeItemDefinition } from '../get-charge-item-definition';

export interface UpdateChargeItemDefinitionParams extends UpdateChargeItemDefinitionInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): UpdateChargeItemDefinitionParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) throw MISSING_REQUEST_BODY;

  const data = safeValidate(UpdateChargeItemDefinitionInputSchema, validateJsonBody(input));

  if (
    data.name === undefined &&
    data.description === undefined &&
    data.effectiveDate === undefined &&
    data.status === undefined &&
    data.default === undefined &&
    data.procedureCodes === undefined
  ) {
    throw INVALID_INPUT_ERROR('At least one field must be updated');
  }

  return {
    ...data,
    secrets: input.secrets,
  };
}

export async function complexValidation(
  oystehr: Oystehr,
  params: UpdateChargeItemDefinitionParams
): Promise<{ definition: ChargeItemDefinition }> {
  const definition = await getChargeItemDefinition(oystehr, {
    type: params.type,
    chargeItemDefinitionId: params.chargeItemDefinitionId,
    secrets: params.secrets,
  });
  return { definition };
}
