import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { CHARGE_ITEM_DEFINITION_TYPE_SYSTEM, createBillingClient } from '../shared';
import { GetChargeItemDefinitionParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'get-charge-item-definition',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const params = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const definition = await performEffect(oystehr, params);

    return {
      statusCode: 200,
      body: JSON.stringify(definition),
    };
  }
);

export async function performEffect(
  oystehr: Oystehr,
  params: GetChargeItemDefinitionParams
): Promise<ChargeItemDefinition> {
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
  return definitions[0];
}
