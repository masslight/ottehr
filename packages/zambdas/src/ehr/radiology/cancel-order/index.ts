import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ServiceRequest } from 'fhir/r4b';
import {
  ACCESSION_NUMBER_CODE_SYSTEM,
  ADVAPACS_FHIR_BASE_URL,
  CancelRadiologyOrderZambdaInput,
  createCancellationTagOperations,
  fetchServiceRequestFromAdvaPACS,
  getSecret,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateInput, validateSecrets } from './validation';

// Types

export interface ValidatedInput {
  body: CancelRadiologyOrderZambdaInput;
  callerAccessToken: string;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'cancel-radiology-order';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const validatedInput = await validateInput(unsafeInput, oystehr);

    await performEffect(validatedInput, secrets, oystehr);

    return {
      statusCode: 204,
      body: JSON.stringify({}),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, unsafeInput.secrets));
  }
});

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
  console.log('setting status to revoked for service request', serviceRequestId);

  // First, get the current ServiceRequest to save its status for potential restoration
  const currentServiceRequest = await oystehr.fhir.get<ServiceRequest>({
    resourceType: 'ServiceRequest',
    id: serviceRequestId,
  });

  const currentStatus = currentServiceRequest.status;
  console.log(`Saving previous status '${currentStatus}' for potential restoration`);

  // Use helper to create cancellation tag operations
  const operations = [
    ...createCancellationTagOperations(currentStatus, currentServiceRequest.meta),
    {
      op: 'replace' as const,
      path: '/status',
      value: 'revoked',
    },
  ];

  return await oystehr.fhir.patch({
    resourceType: 'ServiceRequest',
    id: serviceRequestId,
    operations,
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

    // Use the shared function to fetch the ServiceRequest from AdvaPACS
    const advapacsSR = await fetchServiceRequestFromAdvaPACS(accessionNumber, secrets);

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
