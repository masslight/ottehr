import { EXTRACTABLE_CARD_DOCUMENT_FILE_TYPES, GetCardExtractionInput, MISSING_REQUEST_BODY, Secrets } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const getCardExtractionRequestSchema = z.object({
  appointmentID: z.string().uuid(),
  cardType: z
    .string()
    .min(1)
    .refine(
      (val) => EXTRACTABLE_CARD_DOCUMENT_FILE_TYPES.includes(val as any),
      (_val) => ({
        message: `cardType must be one of the following values: ${EXTRACTABLE_CARD_DOCUMENT_FILE_TYPES.join(', ')}`,
      })
    ),
});

export function validateRequestParameters(input: ZambdaInput): GetCardExtractionInput & {
  secrets: Secrets | null;
} {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { appointmentID, cardType } = safeValidate(getCardExtractionRequestSchema, parsed);

  return {
    appointmentID,
    cardType: cardType as GetCardExtractionInput['cardType'],
    secrets: input.secrets,
  };
}
