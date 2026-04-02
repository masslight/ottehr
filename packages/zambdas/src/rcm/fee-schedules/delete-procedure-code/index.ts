import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import { createOystehrClient, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler(
  'delete-procedure-code',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { feeScheduleId, index, secrets } = validateRequestParameters(input);
      const oystehr = createOystehrClient(input.accessToken!, secrets);

      const existing = await oystehr.fhir.get<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        id: feeScheduleId,
      });

      const propertyGroups = [...(existing.propertyGroup || [])];
      if (index >= propertyGroups.length) {
        throw new Error(`Index ${index} is out of bounds (${propertyGroups.length} property groups)`);
      }

      propertyGroups.splice(index, 1);

      const updated = await oystehr.fhir.update<ChargeItemDefinition>(
        {
          ...existing,
          propertyGroup: propertyGroups.length > 0 ? propertyGroups : undefined,
        },
        { optimisticLockingVersionId: existing.meta?.versionId }
      );

      return {
        statusCode: 200,
        body: JSON.stringify(updated),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('delete-procedure-code', error, ENVIRONMENT);
    }
  }
);
