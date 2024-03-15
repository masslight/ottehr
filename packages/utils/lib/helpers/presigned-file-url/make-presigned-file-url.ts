import { ZambdaInput } from '../../types';
import { getSecret, Secrets, SecretsKeys } from '../../secrets';
import { validateRequestParameters } from './validate-request-parameters';
import { FhirClient } from '@zapehr/sdk';
import { Appointment } from 'fhir/r4';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const makePresignedFileURL = async (
  input: ZambdaInput,
  getAccessToken: (secrets: Secrets | null, type?: 'regular' | 'messaging') => Promise<string>,
  createFhirClient: (token: string, secrets: Secrets | null) => FhirClient,
  getAppointmentResource: (appointmentID: string, fhirClient: FhirClient) => Promise<Appointment | undefined>
): Promise<{ presignedURL: string; z3URL: string }> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { appointmentID, fileType, fileFormat, secrets } = validatedParameters;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (!zapehrToken) {
    console.log('getting token');
    zapehrToken = await getAccessToken(secrets);
  } else {
    console.log('already have token');
  }

  const fhirClient = createFhirClient(zapehrToken, secrets);
  // const z3Client = createZ3Client(zapehrToken, secrets);

  console.log(`getting appointment with id ${appointmentID}`);
  const appointment = await getAppointmentResource(appointmentID, fhirClient);
  if (!appointment) {
    throw new Error('Appointment is not found');
  }
  const patient = appointment?.participant.find(
    (participantTemp) => participantTemp.actor?.reference?.startsWith('Patient/')
  )?.actor?.reference;
  if (!patient) {
    throw new Error('Patient is not found');
  }
  const patientID = patient.replace('Patient/', '');

  let bucketName = '';
  if (fileType === 'photo-id-front') {
    bucketName = 'photo-id-cards';
  } else if (fileType === 'photo-id-back') {
    bucketName = 'photo-id-cards';
  } else if (fileType === 'insurance-card-front') {
    bucketName = 'insurance-cards';
  } else if (fileType === 'insurance-card-back') {
    bucketName = 'insurance-cards';
  } else {
    throw Error('Unknown bucket');
  }

  const environment = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  // console.log(await z3Client.getObjectsInBucket(`${environment}-${bucketName}`));
  // const presignedURL = await z3Client.createPresignedUrl(`${environment}-${bucketName}/`, `test`);
  const fileURL = `${getSecret(
    SecretsKeys.PROJECT_API,
    secrets
  )}/z3/${environment}-${bucketName}/${patientID}/${Date.now()}-${fileType}.${fileFormat}`;
  console.log('make presigned URL request');
  const presignedURLRequest = await fetch(fileURL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${zapehrToken}`,
    },
    body: JSON.stringify({ action: 'upload' }),
  });
  console.log('presigned URL request successfully made');
  const presignedURLResponse = await presignedURLRequest.json();

  return { presignedURL: presignedURLResponse.signedUrl, z3URL: fileURL };
};
