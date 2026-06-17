import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';
import { CreateUploadPatientDocumentInput } from '.';

const CreateUploadDocumentBodySchema = z.object({
  patientId: z.string(),
  fileFolderId: z.string(),
  fileName: z.string(),
  internalName: z.string().optional(),
});

export function validateRequestParameters(input: ZambdaInput): CreateUploadPatientDocumentInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (!input.headers?.Authorization) {
    throw new Error('Authorization header is required');
  }

  const { patientId, fileFolderId, fileName, internalName } = safeValidate(
    CreateUploadDocumentBodySchema,
    safeJsonParse(input.body)
  );
  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return {
    secrets: input.secrets,
    patientId,
    fileFolderId,
    fileName,
    userToken,
    internalName,
  };
}
