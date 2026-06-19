import { AdHocBillingInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): AdHocBillingInput & { secrets: Secrets } {
  if (!input.body) {
    throw new Error('Missing request body');
  }

  const { dateRange, includePayments, includeCoverage, includeCharges, includeCodes } = JSON.parse(input.body);

  if (!dateRange || typeof dateRange.start !== 'string' || typeof dateRange.end !== 'string') {
    throw new Error('dateRange { start, end } is required');
  }

  if (!input.secrets) {
    throw new Error('Input did not have any secrets');
  }

  return {
    dateRange,
    includePayments: includePayments === true,
    includeCoverage: includeCoverage === true,
    includeCharges: includeCharges === true,
    includeCodes: includeCodes === true,
    secrets: input.secrets,
  };
}
