import { SaveAdHocReportInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): SaveAdHocReportInput & { secrets: Secrets } {
  if (!input.body) {
    throw new Error('Missing request body');
  }

  const { reportId, definition } = JSON.parse(input.body);

  if (!definition || typeof definition !== 'object') {
    throw new Error('Missing or invalid definition');
  }
  if (typeof definition.name !== 'string' || definition.name.trim().length === 0) {
    throw new Error('definition.name is required');
  }
  if (typeof definition.datasetId !== 'string' || definition.datasetId.trim().length === 0) {
    throw new Error('definition.datasetId is required');
  }
  if (typeof definition.code !== 'string' || definition.code.trim().length === 0) {
    throw new Error('definition.code is required');
  }
  if (
    !definition.criteria ||
    typeof definition.criteria !== 'object' ||
    typeof definition.criteria.dateRange !== 'string'
  ) {
    throw new Error('definition.criteria.dateRange is required');
  }
  if (reportId !== undefined && typeof reportId !== 'string') {
    throw new Error('reportId must be a string');
  }

  if (!input.secrets) {
    throw new Error('Input did not have any secrets');
  }

  return { reportId, definition, secrets: input.secrets };
}
