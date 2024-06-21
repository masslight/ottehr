import { Secrets } from '../../secrets';
import { INSURANCE_CARD_BACK_ID, INSURANCE_CARD_FRONT_ID, PHOTO_ID_BACK_ID, PHOTO_ID_FRONT_ID } from '../../types';

export interface GetPresignedFileURLInput {
  appointmentID: string;
  fileType:
    | typeof PHOTO_ID_FRONT_ID
    | typeof PHOTO_ID_BACK_ID
    | typeof INSURANCE_CARD_FRONT_ID
    | typeof INSURANCE_CARD_BACK_ID;
  fileFormat: 'jpg' | 'jpeg' | 'png';
  secrets: Secrets | null;
}
