import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Extension, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL,
} from 'utils/lib/fhir/radiology';
import { Secrets } from 'utils/lib/secrets';
import { SendForFinalReadZambdaOutput } from 'utils/lib/types/api/radiology';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { resolveCallerPractitionerRef } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { ValidatedInput, validateInput, validateSecrets } from './validation';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'send-for-final-read';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    const validatedInput = await validateInput(unsafeInput);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

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

  // Who sent it, recorded alongside when — the "pending final" history row's own performer.
  const sentBy = await resolveCallerPractitionerRef(validatedInput.callerAccessToken, secrets, oystehr);

  // Built explicitly rather than through getPatchOperationToUpdateExtension: that helper mutates the
  // resource's extension array in place, so two calls against one resource alias each other's output.
  const unrelatedExtensions = (existingExtensions ?? []).filter(
    (ext) =>
      ext.url !== SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL &&
      ext.url !== SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL
  );
  const updatedExtensions: Extension[] = [
    ...unrelatedExtensions,
    {
      url: SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
      valueDateTime: DateTime.now().toISO()!,
    },
    { url: SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL, valueReference: sentBy },
  ];

  await oystehr.fhir.patch({
    resourceType: 'ServiceRequest',
    id: serviceRequest.id!,
    operations: [
      {
        op: serviceRequest.extension ? 'replace' : 'add',
        path: '/extension',
        value: updatedExtensions,
      },
    ],
  });
  console.debug('Service request patched successfully to send for final read');

  return {};
}
