import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';
import { EmployerAddressInput, EmployerContactInput, EmployerIdentifierInput } from '../helpers';

export interface CreateEmployerParams {
  name: string;
  active?: boolean;
  category?: string;
  identifier?: EmployerIdentifierInput;
  address?: EmployerAddressInput;
  contact?: EmployerContactInput;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CreateEmployerParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { name, active, category, identifier, address, contact } = JSON.parse(input.body);

  if (!name) {
    throw MISSING_REQUIRED_PARAMETERS(['name']);
  }

  if (typeof name !== 'string' || !name.trim()) {
    throw INVALID_INPUT_ERROR('"name" must be a non-empty string');
  }

  if (category !== undefined && (typeof category !== 'string' || !category.trim())) {
    throw INVALID_INPUT_ERROR('"category" must be a non-empty string when provided');
  }

  if (active !== undefined && typeof active !== 'boolean') {
    throw INVALID_INPUT_ERROR('"active" must be a boolean when provided');
  }

  return {
    name,
    active,
    category,
    identifier,
    address,
    contact,
    secrets: input.secrets,
  };
}
