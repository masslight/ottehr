import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition, ChargeItemDefinitionPropertyGroup, Extension } from 'fhir/r4b';
import { CPT_CODE_SYSTEM, CPT_MODIFIER_EXTENSION_URL, getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'cm-bulk-add-procedure-codes',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { chargeMasterId, codes, secrets } = validateRequestParameters(input);

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);

      const existing = await oystehr.fhir.get<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        id: chargeMasterId,
      });

      const newPropertyGroups: ChargeItemDefinitionPropertyGroup[] = codes.map((entry) => {
        const extensions: Extension[] = [];
        if (entry.modifier) {
          extensions.push({
            url: CPT_MODIFIER_EXTENSION_URL,
            valueCode: entry.modifier,
          });
        }

        return {
          priceComponent: [
            {
              type: 'base' as const,
              code: {
                coding: [{ system: CPT_CODE_SYSTEM, code: entry.code }],
              },
              amount: {
                value: entry.amount,
                currency: 'USD',
              },
              ...(extensions.length > 0 ? { extension: extensions } : {}),
            },
          ],
        };
      });

      const updated = await oystehr.fhir.update<ChargeItemDefinition>({
        ...existing,
        propertyGroup: [...(existing.propertyGroup || []), ...newPropertyGroups],
      });

      return {
        statusCode: 200,
        body: JSON.stringify(updated),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('cm-bulk-add-procedure-codes', error, ENVIRONMENT);
    }
  }
);
