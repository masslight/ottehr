import { ZambdaInput } from '../../../shared';

export interface DeleteFeeScheduleParams {
  id: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DeleteFeeScheduleParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { id } = JSON.parse(input.body);

  if (!id) {
    throw new Error('This field is required: "id"');
  }

  return {
    id,
    secrets: input.secrets,
  };
}
