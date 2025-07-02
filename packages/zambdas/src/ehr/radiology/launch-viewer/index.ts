import { APIGatewayProxyResult } from 'aws-lambda';
import { ServiceRequest } from 'fhir/r4b';
import { getSecret, RadiologyLaunchViewerZambdaOutput, RoleType, Secrets, SecretsKeys, User } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, ZambdaInput } from '../../../shared';
import { ACCESSION_NUMBER_CODE_SYSTEM, ADVAPACS_VIEWER_LAUNCH_URL } from '../shared';
import { validateInput, validateSecrets } from './validation';

// Types
export interface ValidatedInput {
  serviceRequest: ServiceRequest;
  callerAccessToken: string;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const validatedInput = await validateInput(unsafeInput, oystehr);

    await accessCheck(validatedInput.callerAccessToken, secrets);

    const result: RadiologyLaunchViewerZambdaOutput = await performEffect(validatedInput, secrets);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

const accessCheck = async (callerAccessToken: string, secrets: Secrets): Promise<void> => {
  const callerUser = await getCallerUserWithAccessToken(callerAccessToken, secrets);

  if (callerUser.profile.indexOf('Practitioner/') === -1) {
    throw new Error('Caller does not have a practitioner profile');
  }
  if (callerUser.roles?.find((role) => role.name === RoleType.Provider) === undefined) {
    throw new Error('Caller does not have provider role');
  }
};

const getCallerUserWithAccessToken = async (token: string, secrets: Secrets): Promise<User> => {
  const oystehr = createOystehrClient(token, secrets);
  return await oystehr.user.me();
};

const performEffect = async (
  validatedInput: ValidatedInput,
  secrets: Secrets
): Promise<RadiologyLaunchViewerZambdaOutput> => {
  const { serviceRequest } = validatedInput;

  try {
    const advapacsClientId = getSecret(SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
    const advapacsClientSecret = getSecret(SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
    const advapacsViewerUsername = getSecret(SecretsKeys.ADVAPACS_VIEWER_USERNAME, secrets);
    const advapacsAuthString = `ID=${advapacsClientId},Secret=${advapacsClientSecret}`;

    const accessionNumber = serviceRequest.identifier?.find(
      (identifier) => identifier.system === ACCESSION_NUMBER_CODE_SYSTEM
    )?.value;

    if (!accessionNumber) {
      throw new Error('No accession number found in oystehr service request.');
    }

    const patientId = serviceRequest.subject.reference?.split('/')[1];

    if (!patientId) {
      throw new Error('No patient ID found in oystehr service request.');
    }

    const response = await fetch(ADVAPACS_VIEWER_LAUNCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: advapacsAuthString,
      },
      body: JSON.stringify({
        // cSpell:disable-next meddream
        viewer: 'meddream',
        patientId,
        accessionNumber: [accessionNumber],
        username: advapacsViewerUsername,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `advapacs request errored out with statusCode ${response.status}, status text ${
          response.statusText
        }, and body ${JSON.stringify(await response.json(), null, 2)}`
      );
    }

    const responseJSON = await response.json();

    if (responseJSON == null || responseJSON.url == null) {
      throw new Error(`Expected response to include url to return to launch viewer.`);
    }

    return {
      url: responseJSON.url,
    };
  } catch (error) {
    console.error('Error updating service request to revoked in AdvaPacs:', error);
    throw new Error('Failed to update service request to revoked in AdvaPacs');
  }
};
