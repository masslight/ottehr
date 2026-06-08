import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export interface ExportPatientRecordInput {
  patientId: string;
}

export function validateRequestParameters(input: ZambdaInput): ExportPatientRecordInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;

  // Use the shared API errors so wrapHandler renders 400s for bad input
  // instead of treating them as unexpected 500s. Guard JSON.parse for the
  // same reason — malformed JSON should be a client error.
  let parsed: { patientId?: unknown };
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body must be valid JSON');
  }

  if (!parsed.patientId) throw MISSING_REQUIRED_PARAMETERS(['patientId']);
  if (typeof parsed.patientId !== 'string') throw INVALID_INPUT_ERROR('"patientId" must be a string');

  return { patientId: parsed.patientId, secrets: input.secrets };
}
