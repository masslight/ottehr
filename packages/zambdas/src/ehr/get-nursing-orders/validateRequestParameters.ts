import { GetNursingOrdersInput, NursingOrdersSearchBy } from 'utils';
import { ZambdaInput } from '../../shared';

export type GetZambdaNursingOrdersParams = GetNursingOrdersInput & { searchBy?: NursingOrdersSearchBy } & Pick<
    ZambdaInput,
    'secrets'
  >;

export function validateRequestParameters(input: ZambdaInput): GetZambdaNursingOrdersParams {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { searchBy, encounterId } = JSON.parse(input.body);

  if (encounterId === undefined) {
    throw new Error('These fields are required: "encounterId"');
  }

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    searchBy,
    encounterId,
    secrets: input.secrets,
  };
}
