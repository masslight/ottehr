import {
  InferAdHocLayersInput,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): InferAdHocLayersInput & { secrets: Secrets } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { datasetId, layers, request, conversation } = JSON.parse(input.body);

  if (!datasetId || typeof datasetId !== 'string') {
    throw MISSING_REQUIRED_PARAMETERS(['datasetId']);
  }

  if (!Array.isArray(layers)) {
    throw INVALID_INPUT_ERROR('layers must be an array');
  }

  if (!request || typeof request !== 'string' || request.trim().length === 0) {
    throw MISSING_REQUIRED_PARAMETERS(['request']);
  }

  if (conversation !== undefined && !Array.isArray(conversation)) {
    throw INVALID_INPUT_ERROR('conversation must be an array');
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  return { datasetId, layers, request, conversation, secrets: input.secrets };
}
