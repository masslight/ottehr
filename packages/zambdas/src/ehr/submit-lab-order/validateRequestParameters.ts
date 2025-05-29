import { SubmitLabOrderInput, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): SubmitLabOrderInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { serviceRequestID, accountNumber, data } = JSON.parse(input.body);

  const missingResources = [];
  if (!serviceRequestID) missingResources.push('serviceRequestID');
  if (!accountNumber) missingResources.push('accountNumber');
  if (!data) missingResources.push('data');
  if (missingResources.length) {
    throw MISSING_REQUIRED_PARAMETERS(missingResources);
  }

  return {
    serviceRequestID,
    accountNumber,
    data,
    secrets: input.secrets,
  };
}
