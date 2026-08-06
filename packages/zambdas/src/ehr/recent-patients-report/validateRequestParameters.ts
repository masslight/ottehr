import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { RecentPatientsReportZambdaInput } from 'utils/lib/types/api/recent-patients-report.types';
import { Secrets } from 'utils/lib/secrets';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse } from '../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): {
  dateRange: { start: string; end: string };
  locationId?: string;
  secrets: Secrets;
} {
  console.log('validating request parameters');
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const requestBody = safeJsonParse(input.body) as RecentPatientsReportZambdaInput;

  if (!requestBody.dateRange) {
    throw new Error('dateRange is required');
  }

  if (!requestBody.dateRange.start || !requestBody.dateRange.end) {
    throw new Error('dateRange must include both start and end dates');
  }

  // Validate date format (basic ISO check)
  const startDate = new Date(requestBody.dateRange.start);
  const endDate = new Date(requestBody.dateRange.end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Invalid date format. Use ISO 8601 format.');
  }

  if (startDate > endDate) {
    throw new Error('Start date must be before or equal to end date');
  }

  if (!input.secrets) {
    throw new Error('Input did not have any secrets');
  }

  const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE } = input.secrets;

  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE) {
    throw MISSING_REQUEST_SECRETS;
  }

  return {
    dateRange: requestBody.dateRange,
    locationId: requestBody.locationId,
    secrets: input.secrets,
  };
}
