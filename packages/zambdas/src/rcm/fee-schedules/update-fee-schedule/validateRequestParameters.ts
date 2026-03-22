import { ZambdaInput } from '../../../shared';

export interface UpdateFeeScheduleParams {
  id: string;
  name: string;
  effectiveDate?: string;
  description: string;
  status?: 'active' | 'retired';
  designation?: 'case-rate' | null;
  caseRateAmount?: number;
  caseRateComment?: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): UpdateFeeScheduleParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { feeScheduleId, name, effectiveDate, description, status, designation, caseRateAmount, caseRateComment } =
    JSON.parse(input.body);

  if (!feeScheduleId) {
    throw new Error('This field is required: "feeScheduleId"');
  }

  if (!name) {
    throw new Error('This field is required: "name"');
  }

  if (status && status !== 'active' && status !== 'retired') {
    throw new Error('"status" must be "active" or "retired"');
  }

  if (designation !== undefined && designation !== 'case-rate' && designation !== null) {
    throw new Error('"designation" must be "case-rate" or null');
  }

  if (caseRateAmount !== undefined && (typeof caseRateAmount !== 'number' || caseRateAmount < 0)) {
    throw new Error('"caseRateAmount" must be a non-negative number');
  }

  return {
    id: feeScheduleId,
    name,
    effectiveDate: effectiveDate || undefined,
    description: description ?? '',
    status,
    designation,
    caseRateAmount,
    caseRateComment: caseRateComment ?? undefined,
    secrets: input.secrets,
  };
}
