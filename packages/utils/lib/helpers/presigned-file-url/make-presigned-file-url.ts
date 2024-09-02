import { FhirClient } from '@zapehr/sdk';
import { Appointment } from 'fhir/r4';
import { Secrets, SecretsKeys, getSecret } from '../../secrets';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_ID,
  PATIENT_PHOTO_ID_PREFIX,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_FRONT_ID,
  SCHOOL_WORK_NOTE_BOTH_ID,
  SCHOOL_WORK_NOTE_BOTH_ID2,
  SCHOOL_WORK_NOTE_PREFIX,
  SCHOOL_WORK_NOTE_SCHOOL_ID,
  SCHOOL_WORK_NOTE_WORK_ID,
  ZambdaInput,
} from '../../types';
import { validateRequestParameters } from './validate-request-parameters';

export const makePresignedFileURL = async (
  input: ZambdaInput,
  createFhirClient: (token: string, secrets: Secrets | null) => FhirClient,
  getAppointmentResource: (appointmentID: string, fhirClient: FhirClient) => Promise<Appointment | undefined>,
  zapehrToken: string,
): Promise<{ presignedURL: string; z3URL: string }> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { appointmentID, fileType, fileFormat, secrets } = validatedParameters;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  const fhirClient = createFhirClient(zapehrToken, secrets);

  console.log(`getting appointment with id ${appointmentID}`);
  const appointment = await getAppointmentResource(appointmentID, fhirClient);
  if (!appointment) {
    throw APPOINTMENT_NOT_FOUND_ERROR;
  }
  const patient = appointment?.participant.find((participantTemp) =>
    participantTemp.actor?.reference?.startsWith('Patient/'),
  )?.actor?.reference;
  if (!patient) {
    throw new Error('Patient is not found');
  }
  const patientID = patient.replace('Patient/', '');

  let bucketName = '';
  if (fileType === PHOTO_ID_FRONT_ID) {
    bucketName = 'photo-id-cards';
  } else if (fileType === PHOTO_ID_BACK_ID) {
    bucketName = 'photo-id-cards';
  } else if (fileType === INSURANCE_CARD_FRONT_ID) {
    bucketName = 'insurance-cards';
  } else if (fileType === INSURANCE_CARD_BACK_ID) {
    bucketName = 'insurance-cards';
  } else if ((fileType as string).startsWith(PATIENT_PHOTO_ID_PREFIX)) {
    bucketName = 'patient-photos';
  } else if (fileType === SCHOOL_WORK_NOTE_SCHOOL_ID) {
    bucketName = `${SCHOOL_WORK_NOTE_PREFIX}-templates`;
  } else if (fileType === SCHOOL_WORK_NOTE_WORK_ID) {
    bucketName = `${SCHOOL_WORK_NOTE_PREFIX}-templates`;
  } else if (fileType === SCHOOL_WORK_NOTE_BOTH_ID) {
    bucketName = `${SCHOOL_WORK_NOTE_PREFIX}-templates`;
  } else if (fileType === SCHOOL_WORK_NOTE_BOTH_ID2) {
    bucketName = `${SCHOOL_WORK_NOTE_PREFIX}-templates`;
  } else {
    throw Error('Unknown bucket');
  }

  // console.log(await z3Client.getObjectsInBucket(`${environment}-${bucketName}`));
  // const presignedURL = await z3Client.createPresignedUrl(`${environment}-${bucketName}/`, `test`);
  const fileURL = makeZ3Url({
    secrets,
    bucketName,
    patientID,
    fileType,
    fileFormat,
  });
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

export interface Z3UrlInput {
  secrets: Secrets | null;
  bucketName: string;
  patientID: string;
  fileType: string;
  fileFormat: string;
}

export const makeZ3Url = (input: Z3UrlInput): string => {
  const { secrets, bucketName, patientID, fileType, fileFormat } = input;
  const environment = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  // console.log(await z3Client.getObjectsInBucket(`${environment}-${bucketName}`));
  // const presignedURL = await z3Client.createPresignedUrl(`${environment}-${bucketName}/`, `test`);
  const fileURL = `${getSecret(
    SecretsKeys.PROJECT_API,
    secrets,
  )}/z3/${environment}-${bucketName}/${patientID}/${Date.now()}-${fileType}.${fileFormat}`;
  console.log('created z3 url: ', fileURL);
  return fileURL;
};

export async function getPresignedURL(url: string, zapehrToken: string): Promise<string> {
  console.log('getting presigned url');
  // const { bucket, object } = getBucketAndObjectFromZ3URL(url, projectAPI);
  // const presignedUrl = (await z3Client.createPresignedUrl(bucket, object)).signedUrl;
  const presignedURLRequest = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${zapehrToken}`,
    },
    body: JSON.stringify({ action: 'download' }),
  });
  const presignedURLResponse = await presignedURLRequest.json();
  const presignedUrl = presignedURLResponse.signedUrl;
  return presignedUrl;
}
