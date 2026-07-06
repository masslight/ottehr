import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import {
  BillingChargeItemDefinition,
  BillingChargeItemDefinitionProcedureCode,
  CPT_CODE_SYSTEM,
  EXTENSION_URL_CPT_MODIFIER,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  CHARGE_ITEM_DEFINITION_TYPE_SYSTEM,
  createBillingClient,
  getDefaultSettingForChargeItemDefinition,
  getTypeForChargeItemDefinition,
} from '../shared';
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
): Promise<BillingChargeItemDefinition> {
  const cid = await getChargeItemDefinition(oystehr, params);
  return transformChargeItemDefinition(cid);
}

export async function getChargeItemDefinition(
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
          value: params.chargeItemDefinitionId,
        },
      ],
    })
  ).unbundle();
  if (!definitions.length) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`The requested ${params.type} could not be found`);
  return definitions[0];
}

export function transformChargeItemDefinition(cid: ChargeItemDefinition): BillingChargeItemDefinition {
  return {
    id: cid.id!,
    type: getTypeForChargeItemDefinition(cid),
    name: cid.title || 'unknown',
    description: cid.description,
    default: getDefaultSettingForChargeItemDefinition(cid),
    status: cid.status === 'active' ? 'active' : 'retired',
    effectiveDate: cid.date,
    procedureCodes: (cid.propertyGroup ?? [])
      .map<BillingChargeItemDefinitionProcedureCode | undefined>((pg) => {
        const pc = pg.priceComponent?.[0];
        if (!pc) {
          return undefined;
        }
        if (!pc.amount || !pc.amount.value) {
          return undefined;
        }
        const coding = pc.code?.coding?.find((c) => c.system === CPT_CODE_SYSTEM);
        if (!coding || !coding.code) {
          return undefined;
        }
        const modifier = pc.extension?.find((e) => e.url === EXTENSION_URL_CPT_MODIFIER);
        return {
          code: coding.code,
          description: coding.display,
          modifier: modifier ? modifier.valueCode : undefined,
          amount: pc.amount.value,
        };
      })
      .filter((pc): pc is BillingChargeItemDefinitionProcedureCode => !!pc),
  };
}
