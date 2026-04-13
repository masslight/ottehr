import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface FindApplicableFeeScheduleParams {
  payerOrganizationId: string;
  dateOfService: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): FindApplicableFeeScheduleParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { payerOrganizationId, dateOfService } = JSON.parse(input.body);

  if (!payerOrganizationId || typeof payerOrganizationId !== 'string') {
    throw MISSING_REQUIRED_PARAMETERS(['payerOrganizationId']);
  }

  if (!dateOfService || typeof dateOfService !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfService)) {
    throw INVALID_INPUT_ERROR('"dateOfService" is required and must be a date string (YYYY-MM-DD)');
  }

  return {
    payerOrganizationId,
    dateOfService,
    secrets: input.secrets,
  };
}
