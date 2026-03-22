import { ZambdaInput } from '../../../shared';

export interface FindApplicableFeeScheduleParams {
  payerOrganizationId: string;
  dateOfService: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): FindApplicableFeeScheduleParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { payerOrganizationId, dateOfService } = JSON.parse(input.body);

  if (!payerOrganizationId || typeof payerOrganizationId !== 'string') {
    throw new Error('"payerOrganizationId" is required');
  }

  if (!dateOfService || typeof dateOfService !== 'string') {
    throw new Error('"dateOfService" is required and must be a date string (YYYY-MM-DD)');
  }

  return {
    payerOrganizationId,
    dateOfService,
    secrets: input.secrets,
  };
}
