import {
  AdHocBillingInput,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): AdHocBillingInput & { secrets: Secrets } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { dateRange, includePayments, includeCoverage, includeCharges, includeCodes, includeClaims } = JSON.parse(
    input.body
  );

  if (!dateRange || typeof dateRange.start !== 'string' || typeof dateRange.end !== 'string') {
    throw MISSING_REQUIRED_PARAMETERS(['dateRange']);
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  return {
    dateRange,
    includePayments: includePayments === true,
    includeCoverage: includeCoverage === true,
    includeCharges: includeCharges === true,
    includeCodes: includeCodes === true,
    includeClaims: includeClaims === true,
    secrets: input.secrets,
  };
}
