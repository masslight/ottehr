import { INVALID_INPUT_ERROR, INVALID_RESOURCE_ID_ERROR, isValidUUID } from 'utils';
import { ZambdaInput } from '../../shared';

export interface SearchBillingPatientsParams {
  name?: string;
  dob?: string;
  identifier?: string;
  uuid?: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingPatientsParams {
  if (input.body) {
    let body: any;
    try {
      body = JSON.parse(input.body);
    } catch {
      throw INVALID_INPUT_ERROR('Request body is not valid JSON');
    }

    const { name, dob, identifier, uuid } = body;

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      throw INVALID_INPUT_ERROR('"name" must be a non-empty string when provided');
    }
    if (dob !== undefined && (typeof dob !== 'string' || !dob.trim())) {
      throw INVALID_INPUT_ERROR('"dob" must be a non-empty string when provided');
    }
    if (identifier !== undefined && (typeof identifier !== 'string' || !identifier.trim())) {
      throw INVALID_INPUT_ERROR('"identifier" must be a non-empty string when provided');
    }
    if (uuid !== undefined) {
      if (typeof uuid !== 'string' || !uuid.trim()) {
        throw INVALID_INPUT_ERROR('"uuid" must be a non-empty string when provided');
      }
      if (!isValidUUID(uuid)) throw INVALID_RESOURCE_ID_ERROR('uuid');
    }

    return { name, dob, identifier, uuid, secrets: input.secrets };
  } else return { secrets: input.secrets };
}
