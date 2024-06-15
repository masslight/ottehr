import { ZambdaInput } from '../types';
import { GetAppointmentsInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetAppointmentsInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { searchDate, locationID, providerIDs, visitType } = JSON.parse(input.body);

  if (locationID === undefined && providerIDs === undefined) {
    throw new Error('Either "locationID" or "providerIDs" is required');
  }

  if (searchDate === undefined) {
    throw new Error('These fields are required: "searchDate"');
  }

  return {
    searchDate,
    locationID,
    providerIDs,
    visitType,
    secrets: input.secrets,
  };
}
