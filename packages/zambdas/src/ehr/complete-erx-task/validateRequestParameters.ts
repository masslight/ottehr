import { CompleteErxTaskInput, CompleteErxTaskInputSchema } from 'utils/lib/types/api/erx.types';
import { validateJsonBody } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';

export function validateRequestParameters(input: ZambdaInput): CompleteErxTaskInput & Pick<ZambdaInput, 'secrets'> {
  const { taskId } = CompleteErxTaskInputSchema.parse(validateJsonBody(input));
  return { taskId, secrets: input.secrets };
}
