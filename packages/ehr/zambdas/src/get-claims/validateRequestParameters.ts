import { ClaimsQueueGetRequest } from 'utils';
import { ZambdaInput } from '../types';
import { SecretsKeys, getSecret } from '../shared';

export function validateRequestParameters(input: ZambdaInput): ClaimsQueueGetRequest & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (getSecret(SecretsKeys.PROJECT_API, input.secrets) === undefined) {
    throw new Error('"PROJECT_API" configuration not provided');
  }
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (input.body) {
    const {
      patient,
      visitId,
      claimId,
      teamMember,
      queue,
      dayInQueue,
      status,
      state,
      facilityGroup,
      facility,
      insurance,
      balance,
      dosFrom,
      dosTo,
      offset,
      pageSize,
    } = JSON.parse(input.body);
    return {
      secrets: input.secrets,
      patient,
      visitId,
      claimId,
      teamMember,
      queue,
      dayInQueue,
      status,
      state,
      facilityGroup,
      facility,
      insurance,
      balance,
      dosFrom,
      dosTo,
      offset,
      pageSize,
    };
  } else return { secrets: input.secrets };
}
