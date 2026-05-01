import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): Pick<ZambdaInput, 'secrets'> {
  return { secrets: input.secrets };
}
