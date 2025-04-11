import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CancelRadiologyOrderZambdaInput, RoleType, Secrets, User } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, ZambdaInput } from '../../../shared';
import { validateInput, validateSecrets } from './validation';

// Types

export interface ValidatedInput {
  body: CancelRadiologyOrderZambdaInput;
  callerAccessToken: string;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const validatedInput = await validateInput(unsafeInput, oystehr);

    await accessCheck(validatedInput.callerAccessToken, secrets);

    await performEffect(validatedInput, secrets, oystehr);

    return {
      statusCode: 204,
      body: JSON.stringify({}),
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

const performEffect = async (validatedInput: ValidatedInput, secrets: Secrets, oystehr: Oystehr): Promise<void> => {
  await patchServiceRequestToRevokedInOystehr(validatedInput.body.serviceRequestId, oystehr);
  await patchServiceRequestToRevokedInAdvaPacs(validatedInput.body.serviceRequestId, secrets);
};

const patchServiceRequestToRevokedInOystehr = async (serviceRequestId: string, oystehr: Oystehr): Promise<void> => {
  await oystehr.fhir.patch({
    resourceType: 'ServiceRequest',
    id: serviceRequestId,
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: 'revoked',
      },
    ],
  });
};

const patchServiceRequestToRevokedInAdvaPacs = async (_serviceRequestId: string, _secrets: Secrets): Promise<void> => {
  // try {
  //   const advapacsClientId = getSecret(SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
  //   const advapacsClientSecret = getSecret(SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
  //   const advapacsAuthString = `ID=${advapacsClientId},Secret=${advapacsClientSecret}`;
  //   // Advapacs doesn't support PATCH right now so the best we can do is GET the latest, and PUT back with the status changed.
  //   const getServiceRequestResponse = await fetch(`${ADVAPACS_FHIR_BASE_URL}/ServiceRequest/${serviceRequestId}`, {
  //     method: 'GET',
  //     headers: {
  //       'Content-Type': 'application/fhir+json',
  //       Authorization: advapacsAuthString,
  //     },
  //   });
  //   const advapacsResponse = await fetch(ADVAPACS_FHIR_BASE_URL, {
  //     method: 'PUT',
  //     headers: {
  //       'Content-Type': 'application/fhir+json',
  //       Authorization: advapacsAuthString,
  //     },
  //     body: JSON.stringify({}),
  //   });
  //   if (!advapacsResponse.ok) {
  //     throw new Error(
  //       `advapacs transaction errored out with statusCode ${advapacsResponse.status}, status text ${
  //         advapacsResponse.statusText
  //       }, and body ${JSON.stringify(await advapacsResponse.json(), null, 2)}`
  //     );
  //   }
  // } catch (error) {
  //   console.error('Error patching service request to revoked in AdvaPacs:', error);
  //   throw new Error('Failed to patch service request to revoked in AdvaPacs');
  // }
};
