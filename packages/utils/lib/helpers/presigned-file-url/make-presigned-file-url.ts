import Oystehr from '@oystehr/sdk';
import { Appointment } from 'fhir/r4b';
import { Secrets, SecretsKeys, getSecret } from '../../secrets';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_FRONT_ID,
  PATIENT_PHOTO_ID_PREFIX,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_FRONT_ID,
  SCHOOL_WORK_NOTE,
  SCHOOL_WORK_NOTE_SCHOOL_ID,
  SCHOOL_WORK_NOTE_WORK_ID,
  ZambdaInput,
} from '../../types';
import { validateRequestParameters } from './validate-request-parameters';
import { DateTime } from 'luxon';

export interface PresignUploadUrlResponse {
  presignedURL: string;
  z3URL: string;
}
export const makePresignedFileURL = async (
  input: ZambdaInput,
  createOystehrClient: (token: string, secrets: Secrets | null) => Oystehr,
  getAppointmentResource: (appointmentID: string, oystehr: Oystehr) => Promise<Appointment | undefined>,
  zapehrToken: string
): Promise<PresignUploadUrlResponse> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { appointmentID, fileType, fileFormat, secrets } = validatedParameters;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  const oystehr = createOystehrClient(zapehrToken, secrets);

  console.log(`getting appointment with id ${appointmentID}`);
  const appointment = await getAppointmentResource(appointmentID, oystehr);
  if (!appointment) {
    throw APPOINTMENT_NOT_FOUND_ERROR;
  }
  const patient = appointment?.participant.find(
    (participantTemp) => participantTemp.actor?.reference?.startsWith('Patient/')
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
  } else if (fileType === INSURANCE_CARD_FRONT_2_ID) {
    bucketName = 'insurance-cards';
  } else if (fileType === INSURANCE_CARD_BACK_2_ID) {
    bucketName = 'insurance-cards';
  } else if (fileType === SCHOOL_WORK_NOTE_SCHOOL_ID) {
    bucketName = `${SCHOOL_WORK_NOTE}-templates`;
  } else if (fileType === SCHOOL_WORK_NOTE_WORK_ID) {
    bucketName = `${SCHOOL_WORK_NOTE}-templates`;
  } else if ((fileType as string).startsWith(PATIENT_PHOTO_ID_PREFIX)) {
    bucketName = `${PATIENT_PHOTO_ID_PREFIX}s`;
  } else {
    throw Error('Unknown bucket');
  }

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
  console.log('presignedURLResponse', JSON.stringify(presignedURLResponse));

  return { presignedURL: presignedURLResponse.signedUrl, z3URL: fileURL };
};

export type Z3UrlInput =
  | {
      secrets: Secrets | null;
      bucketName: string;
      patientID: string;
      fileType: string;
      fileFormat: string;
    }
  | {
      secrets: Secrets | null;
      bucketName: string;
      patientID: string;
      fileName: string;
    };

export const makeZ3Url = (input: Z3UrlInput): string => {
  const { secrets, bucketName, patientID } = input;
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const dateTimeNow = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
  let resolvedFileName: string;
  if ('fileName' in input) {
    resolvedFileName = input.fileName;
  } else {
    resolvedFileName = `${input.fileType}.${input.fileFormat}`;
  }
  const fileURL = `${getSecret(
    SecretsKeys.PROJECT_API,
    secrets
  )}/z3/${projectId}-${bucketName}/${patientID}/${dateTimeNow}-${resolvedFileName}`;
  console.log('created z3 url: ', fileURL);
  return fileURL;
};

export async function getPresignedURL(url: string, zapehrToken: string): Promise<string> {
  console.log('getting presigned url');
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
