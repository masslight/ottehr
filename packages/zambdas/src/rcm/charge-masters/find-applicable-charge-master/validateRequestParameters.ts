import { ZambdaInput } from '../../../shared';

export interface FindApplicableChargeMasterParams {
  payerOrganizationId?: string;
  dateOfService: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): FindApplicableChargeMasterParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { payerOrganizationId, dateOfService } = JSON.parse(input.body);

  if (!dateOfService || typeof dateOfService !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfService)) {
    throw new Error('"dateOfService" is required and must be a date string (YYYY-MM-DD)');
  }

  return {
    payerOrganizationId: payerOrganizationId || undefined,
    dateOfService,
    secrets: input.secrets,
  };
}
