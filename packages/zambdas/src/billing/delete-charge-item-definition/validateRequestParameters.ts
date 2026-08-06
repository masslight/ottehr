import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition } from 'fhir/r4b';
import {
  DeleteChargeItemDefinitionInput,
  DeleteChargeItemDefinitionInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';
import { validateJsonBody } from '../../shared/helpers';
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
    chargeItemDefinitionId: params.chargeItemDefinitionId,
    secrets: params.secrets,
  });
  return { definition };
}
