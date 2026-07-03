import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS, UploadDotVisionDocumentInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): UploadDotVisionDocumentInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsed = JSON.parse(input.body) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }

  const { appointmentID, z3URL, title } = parsed as Record<string, unknown>;

  const missing: string[] = [];
  if (!appointmentID) missing.push('appointmentID');
  if (!z3URL) missing.push('z3URL');
  if (missing.length) throw MISSING_REQUIRED_PARAMETERS(missing);

  if (typeof appointmentID !== 'string') throw INVALID_INPUT_ERROR('appointmentID must be a string');
  if (typeof z3URL !== 'string') throw INVALID_INPUT_ERROR('z3URL must be a string');
  if (title !== undefined && typeof title !== 'string') throw INVALID_INPUT_ERROR('title must be a string');

  if (!input.secrets) throw new Error('No secrets provided in input');

  return {
    appointmentID,
    z3URL,
    title: typeof title === 'string' ? title : undefined,
    secrets: input.secrets,
  };
}
