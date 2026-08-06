import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { AdminUpdateLocationSupportPhonesInput } from 'utils/lib/types/data/support-dialog';
import { LOCATION_SUPPORT_PHONE_EXTENSION_URL } from 'utils/lib/utils/support-dialog';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { topLevelCatch } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-update-location-support-phones';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  try {
    const validatedInput = validateRequestParameters(input);
    const { secrets } = validatedInput;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    await performEffect(validatedInput, oystehr);

    return { statusCode: 204, body: '' };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const performEffect = async (
  validatedInput: AdminUpdateLocationSupportPhonesInput,
  oystehr: Oystehr
): Promise<void> => {
  const { updates } = validatedInput;
  const trimmedUpdates = updates.map((u) => ({ locationId: u.locationId, phoneNumber: u.phoneNumber.trim() }));

  await Promise.all(
    trimmedUpdates.map(async (update) => {
      const location = await oystehr.fhir.get<Location>({ resourceType: 'Location', id: update.locationId });
      const otherExtensions = (location.extension ?? []).filter((e) => e.url !== LOCATION_SUPPORT_PHONE_EXTENSION_URL);
      const supportPhoneExtension = { url: LOCATION_SUPPORT_PHONE_EXTENSION_URL, valueString: update.phoneNumber };

      const extensionsToUpdate = update.phoneNumber ? [...otherExtensions, supportPhoneExtension] : otherExtensions;
      const locationToUpdate: Location = { ...location, extension: extensionsToUpdate };

      await oystehr.fhir.update<Location>(
        locationToUpdate,
        location.meta?.versionId ? { optimisticLockingVersionId: location.meta.versionId } : undefined
      );
    })
  );
};
