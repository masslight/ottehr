import { INVALID_INPUT_ERROR, isValidUUID, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';
import { EmployerAddressInput, EmployerContactInput, EmployerIdentifierInput } from '../helpers';

export interface UpdateEmployerParams {
  employerId: string;
  name?: string;
  active?: boolean;
  category?: string;
  identifier?: EmployerIdentifierInput | null;
  address?: EmployerAddressInput | null;
  contact?: EmployerContactInput | null;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): UpdateEmployerParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { employerId, name, active, category, identifier, address, contact } = JSON.parse(input.body);

  if (!employerId) {
    throw MISSING_REQUIRED_PARAMETERS(['employerId']);
  }

  if (typeof employerId !== 'string' || !isValidUUID(employerId)) {
    throw INVALID_INPUT_ERROR('"employerId" must be a valid UUID');
  }

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    throw INVALID_INPUT_ERROR('"name" must be a non-empty string when provided');
  }

  if (category !== undefined && (typeof category !== 'string' || !category.trim())) {
    throw INVALID_INPUT_ERROR('"category" must be a non-empty string when provided');
  }

  if (identifier && !identifier.value) {
    throw INVALID_INPUT_ERROR('"identifier.value" is required when identifier is provided');
  }

  if (active !== undefined && typeof active !== 'boolean') {
    throw INVALID_INPUT_ERROR('"active" must be a boolean when provided');
  }

  return {
    employerId,
    name,
    active,
    category,
    identifier,
    address,
    contact,
    secrets: input.secrets,
  };
}
