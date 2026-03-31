import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface UpdateChargeMasterParams {
  id: string;
  name: string;
  effectiveDate: string;
  description: string;
  status?: 'active' | 'retired';
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): UpdateChargeMasterParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { chargeMasterId, name, effectiveDate, description, status } = JSON.parse(input.body);

  if (!chargeMasterId) {
    throw MISSING_REQUIRED_PARAMETERS(['chargeMasterId']);
  }

  if (!name || !effectiveDate) {
    throw MISSING_REQUIRED_PARAMETERS(['name', 'effectiveDate']);
  }

  if (status && status !== 'active' && status !== 'retired') {
    throw INVALID_INPUT_ERROR('"status" must be "active" or "retired"');
  }

  return {
    id: chargeMasterId,
    name,
    effectiveDate,
    description: description ?? '',
    status,
    secrets: input.secrets,
  };
}
