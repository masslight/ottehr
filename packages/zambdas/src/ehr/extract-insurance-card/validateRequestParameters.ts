import { DocumentType } from 'utils/lib/types/data/documents';
import { ExtractCardInput } from 'utils/lib/types/api/extract-card.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { Secrets } from 'utils/lib/secrets';
import { ZambdaInput } from '../../shared/types/common';

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
