import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition } from 'fhir/r4b';
import {
  DeleteChargeItemDefinitionInput,
  DeleteChargeItemDefinitionInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';
import { getChargeItemDefinition } from '../get-charge-item-definition';

export interface DeleteChargeItemDefinitionParams extends DeleteChargeItemDefinitionInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DeleteChargeItemDefinitionParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) throw MISSING_REQUEST_BODY;

  const data = safeValidate(DeleteChargeItemDefinitionInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}

export async function complexValidation(
  oystehr: Oystehr,
  params: DeleteChargeItemDefinitionParams
): Promise<{ definition: ChargeItemDefinition }> {
  const definition = await getChargeItemDefinition(oystehr, {
    type: params.type,
    id: params.id,
    secrets: params.secrets,
  });
  return { definition };
}
