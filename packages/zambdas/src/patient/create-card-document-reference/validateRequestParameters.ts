import { CARD_DOCUMENT_FILE_TYPES, CreateCardDocumentReferenceInput, MISSING_REQUEST_BODY, Secrets } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const bodySchema = z.object({
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

export function validateRequestParameters(input: ZambdaInput): CreateCardDocumentReferenceInput & {
  secrets: Secrets | null;
} {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { appointmentID, cardType, z3URL } = safeValidate(bodySchema, parsed);

  return {
    appointmentID,
    cardType: cardType as CreateCardDocumentReferenceInput['cardType'],
    z3URL,
    secrets: input.secrets,
  };
}
