import { DocumentType, ExtractCardInput, INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

// The four card *image* slots. Other titles sharing the 64290-0 type code (e.g. the
// 'fullInsuranceCard' PDFs) are skipped, not errored — checked against the freshly-fetched
// DocumentReference in runInsuranceCardExtraction, not here.
export const CARD_IMAGE_TITLES: readonly DocumentType[] = [
  DocumentType.InsuranceFront,
  DocumentType.InsuranceBack,
  DocumentType.InsuranceFrontSecondary,
  DocumentType.InsuranceBackSecondary,
];

interface Input extends ExtractCardInput {
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): Input {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { documentReferenceId } = JSON.parse(input.body);

  if (!documentReferenceId || typeof documentReferenceId !== 'string') {
    throw INVALID_INPUT_ERROR('"documentReferenceId" must be a non-empty string.');
  }

  return { documentReferenceId, secrets: input.secrets };
}
