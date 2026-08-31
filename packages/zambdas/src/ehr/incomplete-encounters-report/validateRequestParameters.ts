import { Secrets } from 'utils/lib/secrets';
import { IncompleteEncountersReportZambdaInput } from 'utils/lib/types/api/incomplete-encounters-report.types';
import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  MISSING_REQUIRED_PARAMETERS,
} from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse } from '../../shared/validation';

export function validateRequestParameters(
  input: ZambdaInput
): IncompleteEncountersReportZambdaInput & { secrets: Secrets } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { dateRange, encounterStatus, includeCodes } = safeJsonParse(input.body);

  if (!dateRange) {
    throw MISSING_REQUIRED_PARAMETERS(['dateRange']);
  }

  if (!dateRange.start || !dateRange.end) {
    throw INVALID_INPUT_ERROR('dateRange must include both start and end dates');
  }

  if (isNaN(Date.parse(dateRange.start))) {
    throw INVALID_INPUT_ERROR('dateRange.start must be a valid ISO date string');
  }

  if (isNaN(Date.parse(dateRange.end))) {
    throw INVALID_INPUT_ERROR('dateRange.end must be a valid ISO date string');
  }

  if (
    encounterStatus &&
    encounterStatus !== 'incomplete' &&
    encounterStatus !== 'complete' &&
    encounterStatus !== 'all'
  ) {
    throw INVALID_INPUT_ERROR("encounterStatus must be 'incomplete', 'complete', or 'all'");
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE } = input.secrets;

  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE) {
    throw MISSING_REQUEST_SECRETS;
  }

  return {
    dateRange,
    encounterStatus,
    includeCodes: includeCodes === true,
    secrets: input.secrets,
  };
}
