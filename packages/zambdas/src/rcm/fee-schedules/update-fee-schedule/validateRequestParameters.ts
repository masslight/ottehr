import { ZambdaInput } from '../../../shared';

export interface UpdateFeeScheduleParams {
  id: string;
  name: string;
  effectiveDate: string;
  description: string;
  status?: 'active' | 'retired';
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): UpdateFeeScheduleParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { feeScheduleId, name, effectiveDate, description, status } = JSON.parse(input.body);

  if (!feeScheduleId) {
    throw new Error('This field is required: "feeScheduleId"');
  }

  if (!name || !effectiveDate) {
    throw new Error('These fields are required: "name", "effectiveDate"');
  }

  if (status && status !== 'active' && status !== 'retired') {
    throw new Error('"status" must be "active" or "retired"');
  }

  return {
    id: feeScheduleId,
    name,
    effectiveDate,
    description: description ?? '',
    status,
    secrets: input.secrets,
  };
}
