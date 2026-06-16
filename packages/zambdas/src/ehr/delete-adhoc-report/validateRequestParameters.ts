import { DeleteAdHocReportInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): DeleteAdHocReportInput & { secrets: Secrets } {
  if (!input.body) {
    throw new Error('Missing request body');
  }

  const { reportId } = JSON.parse(input.body);

  if (typeof reportId !== 'string' || reportId.trim().length === 0) {
    throw new Error('reportId is required');
  }

  if (!input.secrets) {
    throw new Error('Input did not have any secrets');
  }

  return { reportId, secrets: input.secrets };
}
