import { LabsRadsProdsReportZambdaInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): LabsRadsProdsReportZambdaInput & { secrets: Secrets } {
  if (!input.body) {
    throw new Error('Missing request body');
  }

  const { dateRange, locationId } = JSON.parse(input.body);

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

  if (new Date(dateRange.start).getTime() > new Date(dateRange.end).getTime()) {
    throw new Error('dateRange.start must be less than or equal to dateRange.end');
  }

  if (!input.secrets) {
    throw new Error('Input did not have any secrets');
  }

  return {
    dateRange,
    locationId,
    secrets: input.secrets,
  };
}
