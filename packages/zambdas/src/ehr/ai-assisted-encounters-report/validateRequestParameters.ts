import { AiAssistedEncountersReportZambdaInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): AiAssistedEncountersReportZambdaInput & { secrets: Secrets } {
  if (!input.body) {
    throw new Error('Missing request body');
  }

  const { dateRange, locationIds } = JSON.parse(input.body);

  if (!dateRange) {
    throw new Error('Missing dateRange parameter');
  }

  if (!dateRange.start || !dateRange.end) {
    throw new Error('dateRange must include both start and end dates');
  }

  // Validate that start and end are valid ISO date strings
  if (isNaN(Date.parse(dateRange.start))) {
    throw new Error('dateRange.start must be a valid ISO date string');
  }

  if (isNaN(Date.parse(dateRange.end))) {
    throw new Error('dateRange.end must be a valid ISO date string');
  }

  // Validate locationIds if provided
  if (locationIds !== undefined && !Array.isArray(locationIds)) {
    throw new Error('locationIds must be an array');
  }

  if (!input.secrets) {
    throw new Error('Input did not have any secrets');
  }

  return {
    dateRange,
    locationIds,
    secrets: input.secrets,
  };
}
