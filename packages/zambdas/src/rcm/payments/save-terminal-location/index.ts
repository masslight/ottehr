import { APIGatewayProxyResult } from 'aws-lambda';
import { Extension, Location } from 'fhir/r4b';
import { getSecret, SCHEDULE_OWNER_STRIPE_TERMINAL_LOCATION_ID_EXTENSION_URL, SecretsKeys } from 'utils';
import { createOystehrClient, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'save-terminal-location';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { locationId, terminalLocationId, secrets } = validateRequestParameters(input);
    const oystehr = createOystehrClient(input.accessToken!, secrets);

    const location = await oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId });

    const updatedExtensions = (location.extension ?? []).filter(
      (ext: Extension) => ext.url !== SCHEDULE_OWNER_STRIPE_TERMINAL_LOCATION_ID_EXTENSION_URL
    );

    if (terminalLocationId) {
      updatedExtensions.push({
        url: SCHEDULE_OWNER_STRIPE_TERMINAL_LOCATION_ID_EXTENSION_URL,
        valueString: terminalLocationId,
      });
    }

    await oystehr.fhir.update<Location>(
      {
        ...location,
        extension: updatedExtensions,
      },
      { optimisticLockingVersionId: location.meta?.versionId }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
