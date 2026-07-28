import { ExtractCardInput, INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

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
