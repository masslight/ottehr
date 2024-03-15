import { ZambdaInput } from '../types';
import { GetAppointmentsInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetAppointmentsInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { searchDate, locationId } = JSON.parse(input.body);

  if (locationId === undefined) {
    throw new Error('These fields are required: "locationId"');
  }

  if (searchDate === undefined) {
    throw new Error('These fields are required: "searchDate"');
  }

  return {
    searchDate,
    locationId,
    secrets: input.secrets,
  };
}
