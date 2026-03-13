import { Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export interface FileInboundFaxInput {
  secrets: Secrets | null;
  taskId: string;
  communicationId: string;
  patientId: string;
  folderId: string;
  documentName: string;
  pdfUrl: string;
}

export function validateRequestParameters(input: ZambdaInput): FileInboundFaxInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const body = JSON.parse(input.body);

  if (!body.taskId) {
    throw new Error('taskId is required');
  }
  if (!body.communicationId) {
    throw new Error('communicationId is required');
  }
  if (!body.patientId) {
    throw new Error('patientId is required');
  }
  if (!body.folderId) {
    throw new Error('folderId is required');
  }
  if (!body.documentName) {
    throw new Error('documentName is required');
  }
  if (!body.pdfUrl) {
    throw new Error('pdfUrl is required');
  }

  return {
    secrets: input.secrets,
    taskId: body.taskId,
    communicationId: body.communicationId,
    patientId: body.patientId,
    folderId: body.folderId,
    documentName: body.documentName,
    pdfUrl: body.pdfUrl,
  };
}
