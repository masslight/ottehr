import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface CreateChargeMasterParams {
  name: string;
  effectiveDate: string;
  description: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CreateChargeMasterParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { name, effectiveDate, description } = JSON.parse(input.body);

  if (!name || !effectiveDate) {
    throw MISSING_REQUIRED_PARAMETERS(['name', 'effectiveDate']);
  }

  return {
    name,
    effectiveDate,
    description: description ?? '',
    secrets: input.secrets,
  };
}
