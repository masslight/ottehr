import { CreateCardDocumentReferenceInput, MISSING_REQUEST_BODY, Secrets } from 'utils';
import { cardDocumentReferenceRequestSchema, safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): CreateCardDocumentReferenceInput & {
  secrets: Secrets | null;
} {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { appointmentID, cardType, z3URL } = safeValidate(cardDocumentReferenceRequestSchema, parsed);

  return {
    appointmentID,
    cardType: cardType as CreateCardDocumentReferenceInput['cardType'],
    z3URL,
    secrets: input.secrets,
  };
}
