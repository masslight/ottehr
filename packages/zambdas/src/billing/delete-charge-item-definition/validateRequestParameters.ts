import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition } from 'fhir/r4b';
import {
  DeleteChargeItemDefinitionInput,
  DeleteChargeItemDefinitionInputSchema,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';
import { CHARGE_ITEM_DEFINITION_TYPE_SYSTEM } from '../shared';

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
  const definitions = (
    await oystehr.fhir.search<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      params: [
        {
          name: '_tag',
          value: `${CHARGE_ITEM_DEFINITION_TYPE_SYSTEM}|${params.type}`,
        },
        {
          name: '_id',
          value: params.id,
        },
      ],
    })
  ).unbundle();
  console.log('colin', definitions.length);
  if (!definitions.length) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`The requested ${params.type} could not be found`);
  return { definition: definitions[0] };
}
