import { GetTelemedAppointmentsInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): GetTelemedAppointmentsInput & { secrets: Secrets | null } {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { dateFilter, usStatesFilter, statusesFilter, patientFilter } = JSON.parse(input.body);

  if (statusesFilter === undefined) {
    throw new Error('These fields are required: "statusesFilter"');
  }

  if (patientFilter === undefined) {
    throw new Error('These fields are required: "patientFilter"');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    dateFilter,
    usStatesFilter,
    patientFilter,
    statusesFilter,
    secrets: input.secrets,
    userToken,
  };
}
