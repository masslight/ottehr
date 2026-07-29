import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition } from 'fhir/r4b';
import {
  BulkAddChargeItemDefinitionProcedureCodesInput,
  BulkAddChargeItemDefinitionProcedureCodesInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { ZambdaInput } from '../../shared';
import { safeValidate, validateJsonBody } from '../../shared';
import { getChargeItemDefinition } from '../get-charge-item-definition';

export interface BulkAddChargeItemDefinitionProcedureCodesParams
  extends BulkAddChargeItemDefinitionProcedureCodesInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): BulkAddChargeItemDefinitionProcedureCodesParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) throw MISSING_REQUEST_BODY;

  const data = safeValidate(BulkAddChargeItemDefinitionProcedureCodesInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}

export async function complexValidation(
  oystehr: Oystehr,
  params: BulkAddChargeItemDefinitionProcedureCodesParams
): Promise<{ definition: ChargeItemDefinition }> {
  const definition = await getChargeItemDefinition(oystehr, {
    type: params.type,
    chargeItemDefinitionId: params.chargeItemDefinitionId,
    secrets: params.secrets,
  });
  return { definition };
}
