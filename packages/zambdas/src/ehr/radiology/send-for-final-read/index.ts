import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getPatchOperationToUpdateExtension,
  Secrets,
  SendForFinalReadZambdaOutput,
  SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { ValidatedInput, validateInput, validateSecrets } from './validation';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'send-for-final-read';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    const validatedInput = await validateInput(unsafeInput);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const output = await performEffect(validatedInput, secrets, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify({ output }),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
});

async function performEffect(
  validatedInput: ValidatedInput,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<SendForFinalReadZambdaOutput> {
  const { serviceRequestId } = validatedInput.body;

  // Get the existing service request from Oystehr
  console.group('Fetching service request from Oystehr');
  const serviceRequest: ServiceRequest = await oystehr.fhir.get({
    resourceType: 'ServiceRequest',
    id: serviceRequestId,
  });
  console.groupEnd();
  console.debug('Service request fetched successfully');

  // Patch the service request to create an extension indicating it is ready for final read, if it is not already there.
  console.group('Patching service request to send for final read');
  const existingExtensions = serviceRequest.extension;
  const hasNeedsFinalReadExtension = existingExtensions?.some(
    (ext) => ext.url === SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL
  );
  const hasBeenSentExtension = existingExtensions?.some(
    (ext) => ext.url === SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL
  );

  if (hasNeedsFinalReadExtension) {
    throw new Error('Service request has already been marked to send for final read');
  }

  if (hasBeenSentExtension) {
    throw new Error('Service request has already been sent for final read');
  }

  const sendToTeleradiologyExtensionOperation = getPatchOperationToUpdateExtension(serviceRequest, {
    url: SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
    valueDateTime: DateTime.now().toISO(),
  });

  if (!sendToTeleradiologyExtensionOperation) {
    throw new Error('Failed to create patch operation for sending to teleradiology extension');
  }

  await oystehr.fhir.patch({
    resourceType: 'ServiceRequest',
    id: serviceRequest.id!,
    operations: [sendToTeleradiologyExtensionOperation!],
  });
  console.debug('Service request patched successfully to send for final read');

  return {};
}
