import {
  GetPresignedFileURLInput,
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_FRONT_ID,
  PATIENT_PHOTO_ID_PREFIX,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_FRONT_ID,
  SCHOOL_WORK_NOTE_SCHOOL_ID,
  SCHOOL_WORK_NOTE_WORK_ID,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets } from 'zambda-utils';

const fileTypes = [
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_FRONT_ID,
  INSURANCE_CARD_FRONT_2_ID,
  PHOTO_ID_FRONT_ID,
  PHOTO_ID_BACK_ID,
  SCHOOL_WORK_NOTE_SCHOOL_ID,
  SCHOOL_WORK_NOTE_WORK_ID,
];
const fileFormats = ['jpg', 'jpeg', 'png', 'pdf'];

export function validateRequestParameters(input: ZambdaInput): GetPresignedFileURLInput & {
  secrets: Secrets | null;
} {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentID, fileType, fileFormat } = JSON.parse(input.body);

  if (appointmentID === undefined || appointmentID === '') {
    throw new Error('"appointmentID" is required');
  }

  if (fileType === undefined || fileType === '') {
    throw new Error('"fileType" is required');
  }

  if (!fileTypes.includes(fileType) && !fileType.startsWith(PATIENT_PHOTO_ID_PREFIX)) {
    throw new Error(`fileType must be one of the following values: ${Object.values(fileTypes).join(', ')}`);
  }

  if (fileFormat === undefined || fileFormat === '') {
    throw new Error('"fileFormat" is required');
  }

  if (!fileFormats.includes(fileFormat)) {
    throw new Error(
      `fileFormat ${fileFormat} must be one of the following values: ${Object.values(fileFormats).join(', ')}`
    );
  }

  return {
    appointmentID,
    fileType,
    fileFormat,
    secrets: input.secrets,
  };
}
