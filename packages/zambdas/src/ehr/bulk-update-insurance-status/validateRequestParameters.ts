import { BulkUpdateInsuranceStatusInput, INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): BulkUpdateInsuranceStatusInput & { secrets: Secrets } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedInput = JSON.parse(input.body) as unknown;

  if (!parsedInput || typeof parsedInput !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }

  const { insuranceIds, active } = parsedInput as Record<string, unknown>;

  const missingFields = [];
  if (insuranceIds === undefined) {
    missingFields.push('insuranceIds');
  }
  if (active === undefined) {
    missingFields.push('active');
  }

  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  if (!Array.isArray(insuranceIds)) {
    throw INVALID_INPUT_ERROR('insuranceIds must be an array');
  }

  if (insuranceIds.length === 0) {
    throw INVALID_INPUT_ERROR('insuranceIds must contain at least one insurance ID');
  }

  if (!insuranceIds.every((id): id is string => typeof id === 'string')) {
    throw INVALID_INPUT_ERROR('All insuranceIds must be strings');
  }

  if (typeof active !== 'boolean') {
    throw INVALID_INPUT_ERROR('active must be a boolean');
  }

  if (!input.secrets) {
    throw new Error('No secrets provided in input');
  }

  return {
    insuranceIds,
    active,
    secrets: input.secrets,
  };
}
