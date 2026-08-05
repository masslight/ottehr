import Oystehr from '@oystehr/sdk';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  BUCKET_NAMES,
  CARD_DOCUMENT_FILE_TYPES,
  CardDocumentFileType,
  getAppointmentResourceById,
  getSecret,
  INVALID_INPUT_ERROR,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_FRONT_ID,
  Secrets,
  SecretsKeys,
} from 'utils';
import { z } from 'zod';
import { getPatientFromAppointment } from './appointment/helpers';

// shared request body for the create/delete card DocumentReference zambdas
export const cardDocumentReferenceRequestSchema = z.object({
  appointmentID: z.string().uuid(),
  cardType: z
    .string()
    .min(1)
    .refine(
      (val) => CARD_DOCUMENT_FILE_TYPES.includes(val as any),
      (_val) => ({
        message: `cardType must be one of the following values: ${CARD_DOCUMENT_FILE_TYPES.join(', ')}`,
      })
    ),
  z3URL: z.string().url(),
});

export interface CardDocumentContext {
  patientID: string;
  isPhotoId: boolean;
}

// Shared trust model for the create/delete card DocumentReference zambdas: both are http_open,
// so the Patient is always re-derived from the appointment, and the client-echoed z3 url is only
// accepted if it is an image url inside that patient's own card bucket folder with the
// `<date>-<unix ts>-<cardType>.<ext>` file name that get-presigned-file-url generates
// (see makeZ3Url)
export const resolveCardDocumentContext = async ({
  appointmentID,
  cardType,
  z3URL,
  secrets,
  oystehr,
}: {
  appointmentID: string;
  cardType: CardDocumentFileType;
  z3URL: string;
  secrets: Secrets | null;
  oystehr: Oystehr;
}): Promise<CardDocumentContext> => {
  console.log(`getting appointment with id ${appointmentID}`);
  const appointment = await getAppointmentResourceById(appointmentID, oystehr);
  if (!appointment) {
    throw APPOINTMENT_NOT_FOUND_ERROR;
  }
  const patientID = getPatientFromAppointment(appointment);
  if (!patientID) {
    throw new Error('Patient is not found');
  }

  const isPhotoId = cardType === PHOTO_ID_FRONT_ID || cardType === PHOTO_ID_BACK_ID;
  const bucketName = isPhotoId ? BUCKET_NAMES.PHOTO_ID_CARDS : BUCKET_NAMES.INSURANCE_CARDS;

  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const projectApi = getSecret(SecretsKeys.PROJECT_API, secrets);
  const expectedPrefix = `${projectApi}/z3/${projectId}-${bucketName}/${patientID}/`;
  const fileName = z3URL.startsWith(expectedPrefix) ? z3URL.slice(expectedPrefix.length) : undefined;
  const fileNamePattern = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-\\d+-${cardType}\\.(jpg|jpeg|png)$`);
  if (!fileName || !fileNamePattern.test(fileName)) {
    throw INVALID_INPUT_ERROR(`z3URL is not a ${cardType} image upload url for this appointment's patient`);
  }

  return { patientID, isPhotoId };
};
