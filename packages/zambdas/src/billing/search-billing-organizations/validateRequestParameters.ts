import { INVALID_INPUT_ERROR } from 'utils';
import { ZambdaInput } from '../../shared';

export interface SearchBillingOrganizationsParams {
  name?: string;
  type?: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingOrganizationsParams {
  if (input.body) {
    let body: any;
    try {
      body = JSON.parse(input.body);
    } catch {
      throw INVALID_INPUT_ERROR('Request body is not valid JSON');
    }

    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
      throw INVALID_INPUT_ERROR('"name" must be a non-empty string when provided');
    }
    if (body.type !== undefined && (typeof body.type !== 'string' || !body.type.trim())) {
      throw INVALID_INPUT_ERROR('"type" must be a non-empty string when provided');
    }

    return { name: body.name, type: body.type, secrets: input.secrets };
  } else return { secrets: input.secrets };
}
