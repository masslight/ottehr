import { GetTelemedAppointmentsInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): GetTelemedAppointmentsInput & { secrets: Secrets | null } {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { dateFilter, timeZone, usStatesFilter, statusesFilter, patientFilter, locationsIdsFilter, visitTypesFilter } =
    JSON.parse(input.body) as GetTelemedAppointmentsInput;

  if (statusesFilter === undefined) {
    throw new Error('These fields are required: "statusesFilter"');
  }

  if (patientFilter === undefined) {
    throw new Error('These fields are required: "patientFilter"');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  // Ensure dateFilter is in YYYY-MM-DD format if provided
  if (dateFilter) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateFilter)) {
      throw new Error('dateFilter must be in YYYY-MM-DD format');
    }
  }

  if (timeZone) {
    if (!Intl.supportedValuesOf('timeZone').includes(timeZone)) {
      throw new Error(`Invalid timeZone: ${timeZone}`);
    }
  }

  if (dateFilter && !timeZone) {
    throw new Error('timeZone is required when dateFilter is provided');
  }

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    dateFilter,
    timeZone,
    usStatesFilter,
    patientFilter,
    statusesFilter,
    secrets: input.secrets,
    userToken,
    locationsIdsFilter,
    visitTypesFilter,
  };
}
