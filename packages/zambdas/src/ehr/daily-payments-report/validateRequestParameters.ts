import { DailyPaymentsReportZambdaInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): {
  dateRange: { start: string; end: string };
  secrets: Secrets;
} {
  console.log('validating request parameters');
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const requestBody = JSON.parse(input.body) as DailyPaymentsReportZambdaInput;

  if (!requestBody.dateRange) {
    throw new Error('dateRange is required');
  }

  if (!requestBody.dateRange.start || !requestBody.dateRange.end) {
    throw new Error('dateRange must include both start and end dates');
  }

  // Validate date format (basic check)
  const startDate = new Date(requestBody.dateRange.start);
  const endDate = new Date(requestBody.dateRange.end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Invalid date format in dateRange');
  }

  if (startDate > endDate) {
    throw new Error('Start date must be before or equal to end date');
  }

  if (!input.secrets) {
    throw new Error('Input did not have any secrets');
  }

  return {
    dateRange: requestBody.dateRange,
    secrets: input.secrets,
  };
}
