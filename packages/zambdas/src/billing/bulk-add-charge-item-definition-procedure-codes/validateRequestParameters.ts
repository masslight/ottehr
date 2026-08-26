import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition } from 'fhir/r4b';
import {
  BulkAddChargeItemDefinitionProcedureCodesInput,
  BulkAddChargeItemDefinitionProcedureCodesInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { validateJsonBody } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';
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
