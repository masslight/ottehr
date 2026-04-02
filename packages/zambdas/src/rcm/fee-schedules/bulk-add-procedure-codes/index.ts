import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition, ChargeItemDefinitionPropertyGroup, Extension } from 'fhir/r4b';
import { CPT_CODE_SYSTEM, CPT_MODIFIER_EXTENSION_URL, getSecret, SecretsKeys } from 'utils';
import { createOystehrClient, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler(
  'bulk-add-procedure-codes',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { feeScheduleId, codes, replaceAll, secrets } = validateRequestParameters(input);
      const oystehr = createOystehrClient(input.accessToken!, secrets);

      const existing = await oystehr.fhir.get<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        id: feeScheduleId,
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

      const updated = await oystehr.fhir.update<ChargeItemDefinition>(
        {
          ...existing,
          propertyGroup: replaceAll ? newPropertyGroups : [...(existing.propertyGroup || []), ...newPropertyGroups],
        },
        { optimisticLockingVersionId: existing.meta?.versionId }
      );

      return {
        statusCode: 200,
        body: JSON.stringify(updated),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('bulk-add-procedure-codes', error, ENVIRONMENT);
    }
  }
);
