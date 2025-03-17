import { ZambdaInput } from 'zambda-utils';
import { GetAppointmentsInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetAppointmentsInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { searchDate, locationID, providerIDs, groupIDs, visitType } = JSON.parse(input.body);

  if (locationID === undefined && providerIDs === undefined && groupIDs === undefined) {
    throw new Error('Either "locationID" or "providerIDs" or "groupIDs" is required');
  }

  if (searchDate === undefined) {
    throw new Error('These fields are required: "searchDate"');
  }

  return {
    searchDate,
    locationID,
    providerIDs,
    groupIDs,
    visitType,
    secrets: input.secrets,
  };
}
