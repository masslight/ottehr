import {
  DeleteVisitFilesInput,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../../shared';

interface Input extends DeleteVisitFilesInput {
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): Input {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  console.log('input', JSON.stringify(input, null, 2));

  const { secrets } = input;
  const { documentId: maybeDocumentId } = JSON.parse(input.body);

  const missingParams: string[] = [];

  if (!maybeDocumentId) {
    missingParams.push('documentId');
  }

  if (missingParams.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingParams);
  }

  console.log('checking documentId validity', maybeDocumentId);

  if (typeof maybeDocumentId !== 'string') {
    throw INVALID_INPUT_ERROR(`"documentId" must be a string.`);
  }

  if (!isValidUUID(maybeDocumentId)) {
    throw INVALID_INPUT_ERROR(`"documentId" must be a valid UUID.`);
  }
  const documentId = maybeDocumentId;

  return {
    secrets,
    documentId,
  };
}
