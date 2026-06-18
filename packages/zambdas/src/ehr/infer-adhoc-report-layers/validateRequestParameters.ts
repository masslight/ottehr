import { InferAdHocLayersInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): InferAdHocLayersInput & { secrets: Secrets } {
  if (!input.body) {
    throw new Error('Missing request body');
  }

  const { datasetId, layers, request, conversation } = JSON.parse(input.body);

  if (!datasetId || typeof datasetId !== 'string') {
    throw new Error('Missing or invalid datasetId');
  }

  if (!Array.isArray(layers)) {
    throw new Error('layers must be an array');
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

  return { datasetId, layers, request, conversation, secrets: input.secrets };
}
