import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
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
    throw MISSING_REQUEST_BODY;
  }

  const { feeScheduleId, name, effectiveDate, description, status, designation, caseRateAmount, caseRateComment } =
    JSON.parse(input.body);

  if (!feeScheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['feeScheduleId']);
  }

  if (!name) {
    throw MISSING_REQUIRED_PARAMETERS(['name']);
  }

  if (status && status !== 'active' && status !== 'retired') {
    throw INVALID_INPUT_ERROR('"status" must be "active" or "retired"');
  }

  if (designation !== undefined && designation !== 'case-rate' && designation !== null) {
    throw INVALID_INPUT_ERROR('"designation" must be "case-rate" or null');
  }

  if (caseRateAmount !== undefined && (typeof caseRateAmount !== 'number' || caseRateAmount < 0)) {
    throw INVALID_INPUT_ERROR('"caseRateAmount" must be a non-negative number');
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
