import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition } from 'fhir/r4b';
import {
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  UpdateChargeItemDefinitionInput,
  UpdateChargeItemDefinitionInputSchema,
} from 'utils';
import { ZambdaInput } from '../../shared';
import { safeValidate, validateJsonBody } from '../../shared';
import { CHARGE_ITEM_DEFINITION_TYPE_SYSTEM } from '../shared';

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
  if (!definitions.length) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`The requested ${params.type} could not be found`);
  return { definition: definitions[0] };
}
