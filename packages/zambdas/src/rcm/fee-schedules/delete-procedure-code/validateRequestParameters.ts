import { ZambdaInput } from '../../../shared';

export interface DeleteProcedureCodeParams {
  feeScheduleId: string;
  index: number;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DeleteProcedureCodeParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { feeScheduleId, index } = JSON.parse(input.body);

  if (!feeScheduleId) {
    throw new Error('This field is required: "feeScheduleId"');
  }

  if (index == null || typeof index !== 'number' || index < 0) {
    throw new Error('"index" must be a non-negative number');
  }

  return {
    feeScheduleId,
    index,
    secrets: input.secrets,
  };
}
