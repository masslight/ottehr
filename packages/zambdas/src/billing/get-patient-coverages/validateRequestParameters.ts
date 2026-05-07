import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export interface GetPatientCoveragesParams {
  patientId: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetPatientCoveragesParams {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let body: any;
  try {
    body = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  if (!body.patientId) throw MISSING_REQUIRED_PARAMETERS(['patientId']);
  if (typeof body.patientId !== 'string' || !body.patientId.trim()) {
    throw INVALID_INPUT_ERROR('"patientId" must be a non-empty string');
  }

  return {
    patientId: body.patientId,
    secrets: input.secrets,
  };
}
