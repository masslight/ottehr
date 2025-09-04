import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS, SubmitLabOrderInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): SubmitLabOrderInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { serviceRequestIDs, manualOrder } = JSON.parse(input.body) as SubmitLabOrderInput;

  if (!serviceRequestIDs) throw MISSING_REQUIRED_PARAMETERS(['serviceRequestIDs']);
  if (serviceRequestIDs && !Object.values(serviceRequestIDs).every((srId) => typeof srId === 'string')) {
    throw Error('Invalid parameter: all values passed to serviceRequestIDs must be strings');
  }

  if (typeof manualOrder !== 'boolean') throw Error('manualOrder is incorrect type, should be boolean');

  return {
    serviceRequestIDs,
    manualOrder,
    secrets: input.secrets,
  };
}
