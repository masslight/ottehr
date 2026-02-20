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
  token: string;
}

export async function validateRequestParameters(input: ZambdaInput): Promise<Input> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  console.log('input', JSON.stringify(input, null, 2));

  const { secrets } = input;
  const { documentId: maybeDocumentId, patientId: maybePatientId } = JSON.parse(input.body);

  const missingParams: string[] = [];

  if (!maybeDocumentId) {
    missingParams.push('documentId');
  }

  if (!maybePatientId) {
    missingParams.push('patientId');
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

  console.log('checking patientId validity', maybePatientId);

  if (typeof maybePatientId !== 'string') {
    throw INVALID_INPUT_ERROR(`"patientId" must be a string.`);
  }

  if (!isValidUUID(maybePatientId)) {
    throw INVALID_INPUT_ERROR(`"patientId" must be a valid UUID.`);
  }
  const patientId = maybePatientId;

  const token = input.headers.Authorization.replace('Bearer ', '');
  if (!token.trim()) {
    throw INVALID_INPUT_ERROR(`Authorization token is required in the header.`);
  }

  return {
    secrets,
    documentId,
    patientId,
    token,
  };
}
