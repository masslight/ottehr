import { Secrets } from '../../secrets';
import {
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_ID,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_FRONT_ID,
  SCHOOL_WORK_NOTE_BOTH_ID,
  SCHOOL_WORK_NOTE_BOTH_ID2,
  SCHOOL_WORK_NOTE_SCHOOL_ID,
  SCHOOL_WORK_NOTE_WORK_ID,
} from '../../types';

export interface GetPresignedFileURLInput {
  appointmentID: string;
  fileType:
    | typeof PHOTO_ID_FRONT_ID
    | typeof PHOTO_ID_BACK_ID
    | typeof INSURANCE_CARD_FRONT_ID
    | typeof INSURANCE_CARD_BACK_ID
    | typeof SCHOOL_WORK_NOTE_SCHOOL_ID
    | typeof SCHOOL_WORK_NOTE_WORK_ID
    | typeof SCHOOL_WORK_NOTE_BOTH_ID
    | typeof SCHOOL_WORK_NOTE_BOTH_ID2;
  fileFormat: 'jpg' | 'jpeg' | 'png' | 'pdf';
  secrets: Secrets | null;
}
