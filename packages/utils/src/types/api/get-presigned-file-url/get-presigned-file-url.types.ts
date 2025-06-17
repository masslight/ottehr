import {
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_FRONT_ID,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_FRONT_ID,
  SCHOOL_WORK_NOTE_SCHOOL_ID,
  SCHOOL_WORK_NOTE_WORK_ID,
} from '../../data';

export interface GetPresignedFileURLInput {
  appointmentID: string;
  fileType:
    | typeof PHOTO_ID_FRONT_ID
    | typeof PHOTO_ID_BACK_ID
    | typeof INSURANCE_CARD_FRONT_ID
    | typeof INSURANCE_CARD_BACK_ID
    | typeof INSURANCE_CARD_FRONT_2_ID
    | typeof INSURANCE_CARD_BACK_2_ID
    | typeof SCHOOL_WORK_NOTE_SCHOOL_ID
    | typeof SCHOOL_WORK_NOTE_WORK_ID;
  fileFormat: 'pdf' | 'jpg' | 'jpeg' | 'png';
}

export interface PresignUploadUrlResponse {
  presignedURL: string;
  z3URL: string;
}
