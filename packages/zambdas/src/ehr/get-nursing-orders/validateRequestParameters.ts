import { GetNursingOrdersInput } from 'utils';
import { ZambdaInput } from '../../shared';

export type GetZambdaNursingOrdersParams = GetNursingOrdersInput & Pick<ZambdaInput, 'secrets'>;

export function validateRequestParameters(input: ZambdaInput): GetZambdaNursingOrdersParams {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { searchBy } = JSON.parse(input.body);

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    searchBy,
    secrets: input.secrets,
  };
}
