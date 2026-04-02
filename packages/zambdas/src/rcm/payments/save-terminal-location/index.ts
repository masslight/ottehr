import { APIGatewayProxyResult } from 'aws-lambda';
import { Extension, Location } from 'fhir/r4b';
import { SCHEDULE_OWNER_STRIPE_TERMINAL_LOCATION_ID_EXTENSION_URL } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'save-terminal-location';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { locationId, terminalLocationId, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

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
});
