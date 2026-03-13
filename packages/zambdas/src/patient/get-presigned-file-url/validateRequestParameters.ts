import {
  GetPresignedFileURLInput,
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_FRONT_ID,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  PATIENT_PHOTO_ID_PREFIX,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_FRONT_ID,
  SCHOOL_WORK_NOTE_SCHOOL_ID,
  SCHOOL_WORK_NOTE_WORK_ID,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../shared';

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
    throw MISSING_REQUEST_BODY;
  }

  const { appointmentID, fileType, fileFormat } = JSON.parse(input.body);

  if (appointmentID === undefined || appointmentID === '') {
    throw MISSING_REQUIRED_PARAMETERS(['appointmentID']);
  }

  if (fileType === undefined || fileType === '') {
    throw MISSING_REQUIRED_PARAMETERS(['fileType']);
  }

  if (!fileTypes.includes(fileType) && !fileType.startsWith(PATIENT_PHOTO_ID_PREFIX)) {
    throw INVALID_INPUT_ERROR(`fileType must be one of the following values: ${Object.values(fileTypes).join(', ')}`);
  }

  if (fileFormat === undefined || fileFormat === '') {
    throw MISSING_REQUIRED_PARAMETERS(['fileFormat']);
  }

  if (!fileFormats.includes(fileFormat)) {
    throw INVALID_INPUT_ERROR(
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
