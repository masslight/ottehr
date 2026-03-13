import { Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export interface DeleteInboundFaxInput {
  secrets: Secrets | null;
  taskId: string;
  communicationId: string;
  pdfUrl: string;
}

export function validateRequestParameters(input: ZambdaInput): DeleteInboundFaxInput {
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
  if (!body.pdfUrl) {
    throw new Error('pdfUrl is required');
  }

  return {
    secrets: input.secrets,
    taskId: body.taskId,
    communicationId: body.communicationId,
    pdfUrl: body.pdfUrl,
  };
}
