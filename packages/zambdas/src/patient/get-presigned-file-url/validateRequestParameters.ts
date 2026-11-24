import { Secrets } from 'utils/lib/secrets';
import { GetPresignedFileURLInput } from 'utils/lib/types/api/get-presigned-file-url/get-presigned-file-url.types';
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
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const fileTypes = [
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_FRONT_ID,
  INSURANCE_CARD_FRONT_2_ID,
  PHOTO_ID_FRONT_ID,
  PHOTO_ID_BACK_ID,
  SCHOOL_WORK_NOTE_SCHOOL_ID,
  SCHOOL_WORK_NOTE_WORK_ID,
] as const;

const PATIENT_PHOTO_FILE_TYPE = new RegExp(`^${PATIENT_PHOTO_ID_PREFIX}[A-Za-z0-9_-]{0,100}$`);

const bodySchema = z.object({
  appointmentID: z.string().uuid(),
  fileType: z
    .string()
    .min(1)
    .refine(
      (val) => fileTypes.includes(val as any) || PATIENT_PHOTO_FILE_TYPE.test(val),
      (_val) => ({
        message: `fileType must be one of the following values: ${fileTypes.join(', ')}`,
      })
    ),
  fileFormat: z.enum(['jpg', 'jpeg', 'png', 'pdf']),
});

export function validateRequestParameters(input: ZambdaInput): GetPresignedFileURLInput & {
  secrets: Secrets | null;
} {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { appointmentID, fileType, fileFormat } = safeValidate(bodySchema, parsed);

  return {
    appointmentID,
    fileType: fileType as GetPresignedFileURLInput['fileType'],
    fileFormat,
    secrets: input.secrets,
  };
}
