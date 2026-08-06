import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment } from 'fhir/r4b';
import { getAppointmentResourceById } from 'utils/lib/fhir/appointments';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { Secrets } from 'utils/lib/secrets';
import { PresignUploadUrlResponse } from 'utils/lib/types/api/get-presigned-file-url/get-presigned-file-url.types';
import {
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_FRONT_ID,
  PATIENT_PHOTO_ID_PREFIX,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_FRONT_ID,
  SCHOOL_WORK_NOTE_SCHOOL_ID,
  SCHOOL_WORK_NOTE_WORK_ID,
} from 'utils/lib/types/data/paperwork/paperwork.constants';
import { APPOINTMENT_NOT_FOUND_ERROR } from 'utils/lib/types/errors';
import { getAuth0Token } from '../../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { makeZ3Url } from '../../shared/presigned-file-urls/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let oystehrToken: string;
const ZAMBDA_NAME = 'get-presigned-file-url';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!oystehrToken) {
    oystehrToken = await getAuth0Token(input.secrets);
  }
  const result = await makePresignedFileURL(
    input,
    createClinicalOystehrClient,
    getAppointmentResourceById,
    oystehrToken
  );

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
});

const makePresignedFileURL = async (
  input: ZambdaInput,
  createOystehrClient: (token: string, secrets: Secrets | null) => Oystehr,
  getAppointmentResource: (appointmentID: string, oystehr: Oystehr) => Promise<Appointment | undefined>,
  oystehrToken: string
): Promise<PresignUploadUrlResponse> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { appointmentID, fileType, fileFormat, secrets } = validatedParameters;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  const oystehr = createOystehrClient(oystehrToken, secrets);

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
    bucketName = BUCKET_NAMES.PHOTO_ID_CARDS;
  } else if (fileType === PHOTO_ID_BACK_ID) {
    bucketName = BUCKET_NAMES.PHOTO_ID_CARDS;
  } else if (fileType === INSURANCE_CARD_FRONT_ID) {
    bucketName = BUCKET_NAMES.INSURANCE_CARDS;
  } else if (fileType === INSURANCE_CARD_BACK_ID) {
    bucketName = BUCKET_NAMES.INSURANCE_CARDS;
  } else if (fileType === INSURANCE_CARD_FRONT_2_ID) {
    bucketName = BUCKET_NAMES.INSURANCE_CARDS;
  } else if (fileType === INSURANCE_CARD_BACK_2_ID) {
    bucketName = BUCKET_NAMES.INSURANCE_CARDS;
  } else if (fileType === SCHOOL_WORK_NOTE_SCHOOL_ID) {
    bucketName = BUCKET_NAMES.SCHOOL_WORK_NOTE_TEMPLATES;
  } else if (fileType === SCHOOL_WORK_NOTE_WORK_ID) {
    bucketName = BUCKET_NAMES.SCHOOL_WORK_NOTE_TEMPLATES;
  } else if ((fileType as string).startsWith(PATIENT_PHOTO_ID_PREFIX)) {
    bucketName = BUCKET_NAMES.PATIENT_PHOTOS;
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
      authorization: `Bearer ${oystehrToken}`,
    },
    body: JSON.stringify({ action: 'upload' }),
  });
  console.log('presigned URL request successfully made');
  const presignedURLResponse = await presignedURLRequest.json();
  console.log('presignedURLResponse', JSON.stringify(presignedURLResponse));

  return { presignedURL: presignedURLResponse.signedUrl, z3URL: fileURL };
};
