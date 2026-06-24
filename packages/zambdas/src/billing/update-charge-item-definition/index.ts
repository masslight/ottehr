import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition, ChargeItemDefinitionPropertyGroup, Coding } from 'fhir/r4b';
import { BillingChargeItemDefinition, CPT_CODE_SYSTEM, CPT_MODIFIER_EXTENSION_URL } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { transformChargeItemDefinition } from '../get-charge-item-definition';
import { CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, chargeItemDefinitionNameToUrl, createBillingClient } from '../shared';
import {
  complexValidation,
  UpdateChargeItemDefinitionParams,
  validateRequestParameters,
} from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'update-charge-item-definition',
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
  params: UpdateChargeItemDefinitionParams,
  cvo: { definition: ChargeItemDefinition }
): Promise<BillingChargeItemDefinition> {
  let tags: Coding[] = [...(cvo.definition.meta?.tag ?? [])];
  if (params.default === null) {
    // Remove 'default' tag
    tags = tags.filter((t) => t.system !== CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM);
  } else if (params.default !== undefined) {
    // Replace 'default' tag
    tags = tags.filter((t) => t.system !== CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM);
    tags.push({ system: CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, code: params.default });
  }

  const url = params.name ? chargeItemDefinitionNameToUrl(params.type, params.name) : cvo.definition.url;

  const cid = await oystehr.fhir.update<ChargeItemDefinition>(
    {
      ...cvo.definition,
      title: params.name ?? cvo.definition.title,
      url,
      date: params.effectiveDate === null ? undefined : params.effectiveDate ?? cvo.definition.date,
      status: params.status ?? cvo.definition.status,
      description: params.description === null ? undefined : params.description ?? cvo.definition.description,
      propertyGroup: params.procedureCodes
        ? params.procedureCodes.map<ChargeItemDefinitionPropertyGroup>((pc) => ({
            priceComponent: [
              {
                type: 'base',
                code: {
                  coding: [
                    { system: CPT_CODE_SYSTEM, code: pc.code, ...(pc.description ? { display: pc.description } : {}) },
                  ],
                },
                amount: { value: pc.amount, currency: 'USD' },
                ...(pc.modifier ? { extension: [{ url: CPT_MODIFIER_EXTENSION_URL, valueCode: pc.modifier }] } : {}),
              },
            ],
          }))
        : cvo.definition.propertyGroup,
      meta: {
        tag: tags,
      },
    },
    { optimisticLockingVersionId: cvo.definition.meta?.versionId }
  );
  return transformChargeItemDefinition(cid);
}
