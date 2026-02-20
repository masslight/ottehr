import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import {
  DeleteVisitFilesInput,
  FHIR_RESOURCE_NOT_FOUND,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  Secrets,
} from 'utils';
import { checkIsEHRUser, getUser, isTestUser, userHasAccessToPatient, ZambdaInput } from '../../../shared';

export interface ValidatedInput {
  body: DeleteVisitFilesInput;
  callerAccessToken: string;
}
export function validateSecrets(secrets: Secrets | null): Secrets {
  if (!secrets) {
    throw new Error('Secrets are required.');
  }

  const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, FHIR_API, PROJECT_API, ENVIRONMENT } = secrets;
  if (
    !AUTH0_ENDPOINT ||
    !AUTH0_CLIENT ||
    !AUTH0_SECRET ||
    !AUTH0_AUDIENCE ||
    !FHIR_API ||
    !PROJECT_API ||
    !ENVIRONMENT
  ) {
    throw new Error('Missing required secrets');
  }
  return {
    AUTH0_ENDPOINT,
    AUTH0_CLIENT,
    AUTH0_SECRET,
    AUTH0_AUDIENCE,
    FHIR_API,
    PROJECT_API,
    ENVIRONMENT,
  };
}

export async function validateRequestParameters(input: ZambdaInput): Promise<ValidatedInput> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  console.log('input', JSON.stringify(input, null, 2));

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
    body: {
      documentId,
      patientId,
    },
    callerAccessToken: token,
  };
}

export async function complexValidation(
  input: ValidatedInput,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<ValidatedInput> {
  const { documentId, patientId } = input.body;
  const { callerAccessToken } = input;

  const user = await getUser(callerAccessToken, secrets);
  const isEHRUser = user && checkIsEHRUser(user);
  const userAccess = await userHasAccessToPatient(user, patientId, oystehr);
  if (!user || (!userAccess && !isEHRUser && !isTestUser(user))) {
    throw NO_READ_ACCESS_TO_PATIENT_ERROR;
  }

  const documentReferences = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        {
          name: '_id',
          value: documentId,
        },
        {
          name: 'status',
          value: 'current',
        },
      ],
    })
  ).unbundle();

  if (!documentReferences || documentReferences.length !== 1 || !documentReferences[0].id) {
    throw FHIR_RESOURCE_NOT_FOUND('DocumentReference');
  }

  const patientReferenceFromDr = documentReferences[0].subject?.reference;
  if (patientReferenceFromDr !== `Patient/${patientId}`) {
    throw INVALID_INPUT_ERROR(`The provided patient ID does not match the patient associated with the document.`);
  }

  return input;
}
