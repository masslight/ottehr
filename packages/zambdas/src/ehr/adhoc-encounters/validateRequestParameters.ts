import { AdHocEncountersInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): AdHocEncountersInput & { secrets: Secrets } {
  if (!input.body) {
    throw new Error('Missing request body');
  }

  const { dateRange, includeCodes, includeTiming, includeAi, includeMedications } = JSON.parse(input.body);

  if (!dateRange || typeof dateRange.start !== 'string' || typeof dateRange.end !== 'string') {
    throw new Error('dateRange { start, end } is required');
  }

  if (!input.secrets) {
    throw new Error('Input did not have any secrets');
  }

  return {
    dateRange,
    includeCodes: includeCodes === true,
    includeTiming: includeTiming === true,
    includeAi: includeAi === true,
    includeMedications: includeMedications === true,
    secrets: input.secrets,
  };
}
