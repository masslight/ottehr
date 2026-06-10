import { GenerateAdHocReportInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GenerateAdHocReportInput & { secrets: Secrets } {
  if (!input.body) {
    throw new Error('Missing request body');
  }

  const { schema, request, conversation } = JSON.parse(input.body);

  if (!schema || typeof schema !== 'object') {
    throw new Error('Missing or invalid schema');
  }

  if (!request || typeof request !== 'string' || request.trim().length === 0) {
    throw new Error('Missing request');
  }

  if (conversation !== undefined && !Array.isArray(conversation)) {
    throw new Error('conversation must be an array');
  }

  if (!input.secrets) {
    throw new Error('Input did not have any secrets');
  }

  return { schema, request, conversation, secrets: input.secrets };
}
