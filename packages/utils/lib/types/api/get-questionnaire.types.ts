import z from 'zod';
import { isValidUUID } from '../../helpers';
import { QAndQRResponse } from '../data';

export const GetQuestionnaireParamsSchema = z
  .object({
    canonicalRef: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (val === undefined) return true;
          const [url, version] = val.split('|');
          if (!url || url.trim() === '') return false;
          if (!version || version.trim() === '') return false;
          return true;
        },
        { message: '"canonicalRef", if specified, must contain a valid URL and version, separated by a pipe (|)' }
      ),
    slotId: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (val === undefined) return true;
          return isValidUUID(val);
        },
        { message: '"slotId" must be a valid UUID' }
      ),
    patientId: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (val === undefined) return true;
          return isValidUUID(val);
        },
        { message: '"patientId" must be a valid UUID' }
      ),
  })
  .refine((data) => data.canonicalRef !== undefined || data.slotId !== undefined, {
    message: 'Either "canonicalRef" or "slotId" must be provided',
  });

export type GetQuestionnaireParams = z.infer<typeof GetQuestionnaireParamsSchema>;

export interface GetQuestionnaireResponse extends QAndQRResponse {
  title?: string;
}
