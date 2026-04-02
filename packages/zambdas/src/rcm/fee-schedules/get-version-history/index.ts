import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import { createOystehrClient, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler('get-version-history', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets, resourceId } = validateRequestParameters(input);
    const oystehr = createOystehrClient(input.accessToken!, secrets);

    const bundle = await oystehr.fhir.history<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      id: resourceId,
    });

    const entries = (bundle.entry || [])
      .filter((e) => e.resource?.meta?.versionId && e.resource?.meta?.lastUpdated)
      .map((e) => ({
        versionId: e.resource!.meta!.versionId!,
        lastUpdated: e.resource!.meta!.lastUpdated!,
        resource: e.resource!,
      }));

    // Sort newest first
    entries.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

    return {
      statusCode: 200,
      body: JSON.stringify({ entries }),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('get-version-history', error, ENVIRONMENT);
  }
});
