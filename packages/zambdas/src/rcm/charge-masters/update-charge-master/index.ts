import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import { createOystehrClient, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler('update-charge-master', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { id, name, effectiveDate, description, status, secrets } = validateRequestParameters(input);
    const oystehr = createOystehrClient(input.accessToken!, secrets);

    const existing = await oystehr.fhir.get<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      id,
    });

    const updated = await oystehr.fhir.update<ChargeItemDefinition>(
      {
        ...existing,
        title: name,
        date: effectiveDate,
        status: status ?? existing.status,
      },
      { optimisticLockingVersionId: existing.meta?.versionId }
    );

    // Handle description separately via PATCH to avoid FHIR empty-string rejection
    if (description) {
      const op = existing.description ? 'replace' : 'add';
      await oystehr.fhir.patch<ChargeItemDefinition>(
        {
          resourceType: 'ChargeItemDefinition',
          id,
          operations: [{ op, path: '/description', value: description }],
        },
        { optimisticLockingVersionId: updated.meta?.versionId }
      );
    } else if (existing.description) {
      await oystehr.fhir.patch<ChargeItemDefinition>(
        {
          resourceType: 'ChargeItemDefinition',
          id,
          operations: [{ op: 'remove', path: '/description' }],
        },
        { optimisticLockingVersionId: updated.meta?.versionId }
      );
    }

    // Re-fetch to return the final state
    const final = await oystehr.fhir.get<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      id,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(final),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('update-charge-master', error, ENVIRONMENT);
  }
});
