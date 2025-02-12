import { ZambdaInput } from 'zambda-utils';
import { CreateUploadPatientDocumentInput } from '.';

export function validateRequestParameters(input: ZambdaInput): CreateUploadPatientDocumentInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { patientId, fileFolderId, fileName } = JSON.parse(input.body);

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return {
    secrets: input.secrets,
    patientId: patientId,
    fileFolderId: fileFolderId,
    fileName: fileName,
    userToken: userToken,
  };
}
