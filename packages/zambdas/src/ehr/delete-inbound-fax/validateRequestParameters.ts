import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { Secrets } from 'utils/lib/secrets';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse } from '../../shared/validation';

export interface DeleteInboundFaxInput {
  secrets: Secrets | null;
  taskId: string;
  communicationId: string;
}

export function validateRequestParameters(input: ZambdaInput): DeleteInboundFaxInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const body = safeJsonParse(input.body);

  const missing: string[] = [];
  if (!body.taskId) missing.push('taskId');
  if (!body.communicationId) missing.push('communicationId');
  if (missing.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missing);
  }

  // SECURITY: any client-supplied `pdfUrl` is intentionally ignored (accepted for backward
  // compatibility, never used). The authoritative pdf url is read from the verified inbound-fax
  // Task's stored `pdf-url` input in the handler; honoring a client value would allow deleting
  // an arbitrary Z3 object (e.g. another patient's document).
  return {
    secrets: input.secrets,
    taskId: body.taskId,
    communicationId: body.communicationId,
  };
}
