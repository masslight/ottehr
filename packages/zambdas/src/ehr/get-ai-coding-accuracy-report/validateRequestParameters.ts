import { Secrets, ZambdaInput } from '../../shared';

export interface AiCodingAccuracyReportInput {
  dateRange: {
    start: string;
    end: string;
  };
  locationIds?: string[];
  secrets: Secrets;
}

export function validateRequestParameters(input: ZambdaInput): AiCodingAccuracyReportInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { dateRange, locationIds } = JSON.parse(input.body);

  if (!dateRange?.start || !dateRange?.end) {
    throw new Error('dateRange with start and end is required');
  }

  return {
    dateRange,
    locationIds,
    secrets: input.secrets,
  };
}
