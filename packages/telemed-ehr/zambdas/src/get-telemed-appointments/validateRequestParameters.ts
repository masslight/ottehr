import { GetTelemedAppointmentsInput } from 'ehr-utils';
import { ZambdaInput } from '../types';

export function validateRequestParameters(input: ZambdaInput): GetTelemedAppointmentsInput {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { dateFilter, stateFilter, statusesFilter, patientFilter } = JSON.parse(input.body);

  if (dateFilter === undefined) {
    throw new Error('These fields are required: "dateFilter"');
  }

  if (statusesFilter === undefined) {
    throw new Error('These fields are required: "statusesFilter"');
  }

  if (patientFilter === undefined) {
    throw new Error('These fields are required: "patientFilter"');
  }

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    dateFilter,
    stateFilter,
    patientFilter,
    statusesFilter,
    secrets: input.secrets,
  };
}
