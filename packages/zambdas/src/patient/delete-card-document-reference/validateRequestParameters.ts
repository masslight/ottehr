import { DeleteCardDocumentReferenceInput, MISSING_REQUEST_BODY, Secrets } from 'utils';
import { cardDocumentReferenceRequestSchema, safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): DeleteCardDocumentReferenceInput & {
  secrets: Secrets | null;
} {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { appointmentID, cardType, z3URL } = safeValidate(cardDocumentReferenceRequestSchema, parsed);

  return {
    appointmentID,
    cardType: cardType as DeleteCardDocumentReferenceInput['cardType'],
    z3URL,
    secrets: input.secrets,
  };
}
