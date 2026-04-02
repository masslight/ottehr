import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import { createOystehrClient, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler(
  'cm-disassociate-payer',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { chargeMasterId, organizationId, secrets } = validateRequestParameters(input);
      const oystehr = createOystehrClient(input.accessToken!, secrets);

      const existing = await oystehr.fhir.get<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        id: chargeMasterId,
      });

      const updatedUseContext = (existing.useContext || []).filter(
        (uc) => uc.valueReference?.reference !== `Organization/${organizationId}`
      );

      const updated = await oystehr.fhir.update<ChargeItemDefinition>(
        {
          ...existing,
          useContext: updatedUseContext.length > 0 ? updatedUseContext : undefined,
        },
        { optimisticLockingVersionId: existing.meta?.versionId }
      );

      return {
        statusCode: 200,
        body: JSON.stringify(updated),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('cm-disassociate-payer', error, ENVIRONMENT);
    }
  }
);
