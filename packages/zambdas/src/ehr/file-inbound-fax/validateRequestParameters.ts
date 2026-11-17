import { Secrets } from 'utils/lib/secrets';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse } from '../../shared/validation';

export interface FileInboundFaxInput {
  secrets: Secrets | null;
  taskId: string;
  communicationId: string;
  patientId: string;
  folderId: string;
  documentName: string;
  // Internal name of the target folder. The client sends a `synthetic:${internalName}` sentinel
  // as `folderId` when the patient has no per-patient List for the folder yet; this is the
  // explicit form of the same information (see resolvePatientDocumentFolder).
  internalName?: string;
  // Visit the filed document is attached to.
  encounterId?: string;
  // When present, a task to review the filed fax is created and assigned to this person.
  reviewTaskAssignee?: { id: string; name: string };
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export function validateRequestParameters(input: ZambdaInput): FileInboundFaxInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const body = safeJsonParse(input.body);

  const missing: string[] = [];
  if (!body.taskId) missing.push('taskId');
  if (!body.communicationId) missing.push('communicationId');
  if (!body.patientId) missing.push('patientId');
  if (!body.folderId) missing.push('folderId');
  if (!body.documentName) missing.push('documentName');
  if (missing.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missing);
  }

  if (body.encounterId != null && !isNonEmptyString(body.encounterId)) {
    throw INVALID_INPUT_ERROR('encounterId must be a non-empty string');
  }
  const assignee = body.reviewTaskAssignee;
  if (assignee != null && !(isNonEmptyString(assignee.id) && isNonEmptyString(assignee.name))) {
    throw INVALID_INPUT_ERROR('reviewTaskAssignee must have a non-empty id and name');
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
    internalName: typeof body.internalName === 'string' && body.internalName ? body.internalName : undefined,
    encounterId: body.encounterId ?? undefined,
    reviewTaskAssignee: assignee ? { id: assignee.id, name: assignee.name } : undefined,
  };
}
