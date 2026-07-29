import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { BillingChargeItemDefinition } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { transformChargeItemDefinition } from '../get-charge-item-definition';
import { createBillingClient, procedureCodesToPropertyGroups } from '../shared';
import {
  BulkAddChargeItemDefinitionProcedureCodesParams,
  complexValidation,
  validateRequestParameters,
} from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'bulk-add-charge-item-definition-procedure-codes',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const params = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const cvo = await complexValidation(oystehr, params);

    const definition = await performEffect(oystehr, params, cvo);

    return {
      statusCode: 200,
      body: JSON.stringify(definition),
    };
  }
);

export async function performEffect(
  oystehr: Oystehr,
  params: BulkAddChargeItemDefinitionProcedureCodesParams,
  cvo: { definition: ChargeItemDefinition }
): Promise<BillingChargeItemDefinition> {
  const newPropertyGroups = procedureCodesToPropertyGroups(params.procedureCodes);

  const cid = await oystehr.fhir.update<ChargeItemDefinition>(
    {
      ...cvo.definition,
      propertyGroup: params.replaceAll
        ? newPropertyGroups
        : [...(cvo.definition.propertyGroup ?? []), ...newPropertyGroups],
    },
    { optimisticLockingVersionId: cvo.definition.meta?.versionId }
  );
  return transformChargeItemDefinition(cid);
}
