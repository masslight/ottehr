import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { LOCATION_SUPPORT_PHONE_EXTENSION_URL } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-update-location-support-phones';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const { secrets, updates } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const trimmedUpdates = updates.map((u) => ({ locationId: u.locationId, phoneNumber: u.phoneNumber.trim() }));

  await Promise.all(
    trimmedUpdates.map(async (update) => {
      const location = await oystehr.fhir.get<Location>({ resourceType: 'Location', id: update.locationId });
      const otherExtensions = (location.extension ?? []).filter((e) => e.url !== LOCATION_SUPPORT_PHONE_EXTENSION_URL);
      const nextExtension = update.phoneNumber
        ? [...otherExtensions, { url: LOCATION_SUPPORT_PHONE_EXTENSION_URL, valueString: update.phoneNumber }]
        : otherExtensions;
      const next: Location = { ...location, extension: nextExtension };
      await oystehr.fhir.update<Location>(
        next,
        location.meta?.versionId ? { optimisticLockingVersionId: location.meta.versionId } : undefined
      );
    })
  );

  return { statusCode: 204, body: JSON.stringify({}) };
});
