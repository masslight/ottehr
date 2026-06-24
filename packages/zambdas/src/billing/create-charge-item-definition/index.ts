import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { BillingChargeItemDefinition } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { transformChargeItemDefinition } from '../get-charge-item-definition';
import {
  CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM,
  CHARGE_ITEM_DEFINITION_TYPE_SYSTEM,
  chargeItemDefinitionNameToUrl,
  createBillingClient,
} from '../shared';
import { CreateChargeItemDefinitionParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'create-charge-item-definition',
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
  params: CreateChargeItemDefinitionParams
): Promise<BillingChargeItemDefinition> {
  const url = chargeItemDefinitionNameToUrl(params.type, params.name);
  const cid = await oystehr.fhir.create<ChargeItemDefinition>({
    resourceType: 'ChargeItemDefinition',
    url,
    status: 'active',
    title: params.name,
    date: params.effectiveDate,
    description: params.description,
    meta: {
      tag: [
        {
          system: CHARGE_ITEM_DEFINITION_TYPE_SYSTEM,
          code: params.type,
        },
        ...(params.default ? [{ system: CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, code: params.default }] : []),
      ],
    },
  });
  return transformChargeItemDefinition(cid);
}
