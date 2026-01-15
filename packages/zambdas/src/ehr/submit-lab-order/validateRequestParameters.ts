import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS, SubmitLabOrderInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): SubmitLabOrderInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { requisitionNumbers, manualOrder } = JSON.parse(input.body) as SubmitLabOrderInput;

  if (!requisitionNumbers || !requisitionNumbers.length) throw MISSING_REQUIRED_PARAMETERS(['requisitionNumbers']);

  if (typeof manualOrder !== 'boolean') throw Error('manualOrder is incorrect type, should be boolean');

  return {
    requisitionNumbers,
    manualOrder,
    secrets: input.secrets,
  };
}
