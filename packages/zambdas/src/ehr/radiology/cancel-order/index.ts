import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ServiceRequest } from 'fhir/r4b';
import { CancelRadiologyOrderZambdaInput, getSecret, RoleType, Secrets, SecretsKeys, User } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, ZambdaInput } from '../../../shared';
import { ACCESSION_NUMBER_CODE_SYSTEM, ADVAPACS_FHIR_BASE_URL } from '../shared';
import { validateInput, validateSecrets } from './validation';

// Types

export interface ValidatedInput {
  body: CancelRadiologyOrderZambdaInput;
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
  const oystehrServiceRequest = await patchServiceRequestToRevokedInOystehr(
    validatedInput.body.serviceRequestId,
    oystehr
  );
  await updateServiceRequestToRevokedInAdvaPacs(oystehrServiceRequest, secrets);
};

const patchServiceRequestToRevokedInOystehr = async (
  serviceRequestId: string,
  oystehr: Oystehr
): Promise<ServiceRequest> => {
  return await oystehr.fhir.patch({
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

const updateServiceRequestToRevokedInAdvaPacs = async (
  oystehrServiceRequest: ServiceRequest,
  secrets: Secrets
): Promise<void> => {
  try {
    const advapacsClientId = getSecret(SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
    const advapacsClientSecret = getSecret(SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
    const advapacsAuthString = `ID=${advapacsClientId},Secret=${advapacsClientSecret}`;

    const accessionNumber = oystehrServiceRequest.identifier?.find(
      (identifier) => identifier.system === ACCESSION_NUMBER_CODE_SYSTEM
    )?.value;

    if (!accessionNumber) {
      throw new Error('No accession number found in oystehr service request, cannot update AdvaPACS.');
    }

    // Advapacs doesn't support PATCH or optimistic locking right now so the best we can do is GET the latest, and PUT back with the status changed.
    // First, search up the SR in AdvaPACS by the accession number
    const findServiceRequestResponse = await fetch(
      `${ADVAPACS_FHIR_BASE_URL}/ServiceRequest?identifier=${ACCESSION_NUMBER_CODE_SYSTEM}%7C${accessionNumber}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/fhir+json',
          Authorization: advapacsAuthString,
        },
      }
    );

    if (!findServiceRequestResponse.ok) {
      throw new Error(
        `advapacs search errored out with statusCode ${findServiceRequestResponse.status}, status text ${
          findServiceRequestResponse.statusText
        }, and body ${JSON.stringify(await findServiceRequestResponse.json(), null, 2)}`
      );
    }

    const maybeAdvaPACSSr = await findServiceRequestResponse.json();

    if (maybeAdvaPACSSr.resourceType !== 'Bundle') {
      throw new Error(`Expected response to be Bundle but got ${maybeAdvaPACSSr.resourceType}`);
    }

    if (maybeAdvaPACSSr.entry.length === 0) {
      throw new Error(`No service request found in AdvaPACS for accession number ${accessionNumber}`);
    }
    if (maybeAdvaPACSSr.entry.length > 1) {
      throw new Error(
        `Found multiple service requests in AdvaPACS for accession number ${accessionNumber}, cannot update.`
      );
    }

    const advapacsSR = maybeAdvaPACSSr.entry[0].resource as ServiceRequest;

    // Update the AdvaPACS SR now that we have its latest data.
    const advapacsResponse = await fetch(`${ADVAPACS_FHIR_BASE_URL}/ServiceRequest/${advapacsSR.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/fhir+json',
        Authorization: advapacsAuthString,
      },
      body: JSON.stringify({
        ...advapacsSR,
        status: 'revoked',
      }),
    });
    if (!advapacsResponse.ok) {
      throw new Error(
        `advapacs transaction errored out with statusCode ${advapacsResponse.status}, status text ${
          advapacsResponse.statusText
        }, and body ${JSON.stringify(await advapacsResponse.json(), null, 2)}`
      );
    }
  } catch (error) {
    console.error('Error updating service request to revoked in AdvaPacs:', error);
    throw new Error('Failed to update service request to revoked in AdvaPacs');
  }
};
