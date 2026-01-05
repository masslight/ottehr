import z from 'zod';
import { isValidUUID } from '../../helpers';
import { QAndQRResponse } from '../data';

export const GetBookingQuestionnaireParamsSchema = z.object({
  slotId: z
    .string()
    .nonempty()
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
});

export type GetBookingQuestionnaireParams = z.infer<typeof GetBookingQuestionnaireParamsSchema>;

export interface GetBookingQuestionnaireResponse extends QAndQRResponse {
  title?: string;
}
