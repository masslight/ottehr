import { ZambdaInput } from '../../shared';
import { CreateUploadPatientDocumentInput } from '.';

export function validateRequestParameters(input: ZambdaInput): CreateUploadPatientDocumentInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (!input.headers?.Authorization) {
    throw new Error('Authorization header is required');
  }

  const { patientId, fileFolderId, fileName, internalName } = JSON.parse(input.body);

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return {
    secrets: input.secrets,
    patientId: patientId,
    fileFolderId: fileFolderId,
    fileName: fileName,
    userToken: userToken,
    internalName: internalName,
  };
}
