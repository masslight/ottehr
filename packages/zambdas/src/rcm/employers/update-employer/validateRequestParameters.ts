import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
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
