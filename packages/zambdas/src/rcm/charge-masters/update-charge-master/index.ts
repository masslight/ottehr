import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('update-charge-master', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { id, name, effectiveDate, description, status, secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const existing = await oystehr.fhir.get<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      id,
    });

    await oystehr.fhir.update<ChargeItemDefinition>({
      ...existing,
      title: name,
      date: effectiveDate,
      status: status ?? existing.status,
    });

    // Handle description separately via PATCH to avoid FHIR empty-string rejection
    if (description) {
      const op = existing.description ? 'replace' : 'add';
      await oystehr.fhir.patch<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        id,
        operations: [{ op, path: '/description', value: description }],
      });
    } else if (existing.description) {
      await oystehr.fhir.patch<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        id,
        operations: [{ op: 'remove', path: '/description' }],
      });
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
