import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { makeCommunicationDTO } from '../../shared/chart-data';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { getMyPractitionerId } from '../../shared/practitioners';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { getCommunicationResources } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-patient-instructions';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { type, secrets, userToken } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);
    // Only the `provider` variant is scoped to the caller — `organization` uses the configured
    // organization id and never needed the caller at all. Resolving it unconditionally cost the
    // organization path a serialized round trip, and made it fail outright for a user without a
    // Practitioner profile: getMyPractitionerId throws, and the catch below turns that into a 500.
    const ORGANIZATION_ID = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);
    const communicationsOwnerId =
      type === 'organization' ? ORGANIZATION_ID : await getMyPractitionerId(userToken, secrets);

    const communications = await getCommunicationResources(oystehr, type, communicationsOwnerId);
    const communicationsDTOs = communications.map((element) => makeCommunicationDTO(element));
    return {
      body: JSON.stringify(communicationsDTOs),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      body: JSON.stringify({ message: 'Error getting patient instructions...' }),
      statusCode: 500,
    };
  }
});
