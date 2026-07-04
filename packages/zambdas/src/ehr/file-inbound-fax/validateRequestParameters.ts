import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export interface FileInboundFaxInput {
  secrets: Secrets | null;
  taskId: string;
  communicationId: string;
  patientId: string;
  folderId: string;
  documentName: string;
}

export function validateRequestParameters(input: ZambdaInput): FileInboundFaxInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const body = JSON.parse(input.body);

  const missing: string[] = [];
  if (!body.taskId) missing.push('taskId');
  if (!body.communicationId) missing.push('communicationId');
  if (!body.patientId) missing.push('patientId');
  if (!body.folderId) missing.push('folderId');
  if (!body.documentName) missing.push('documentName');
  if (missing.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missing);
  }

  // SECURITY: any client-supplied `pdfUrl` is intentionally ignored (accepted for backward
  // compatibility, never used). The authoritative pdf url is read from the verified inbound-fax
  // Task's stored `pdf-url` input in the handler; honoring a client value would allow filing an
  // arbitrary URL into a patient's chart.
  return {
    secrets: input.secrets,
    taskId: body.taskId,
    communicationId: body.communicationId,
    patientId: body.patientId,
    folderId: body.folderId,
    documentName: body.documentName,
  };
}
