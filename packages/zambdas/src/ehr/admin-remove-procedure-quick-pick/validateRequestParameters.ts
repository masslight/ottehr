import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS, RemoveProcedureQuickPickInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): RemoveProcedureQuickPickInput & { secrets: Secrets } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedInput = JSON.parse(input.body) as unknown;

  if (!parsedInput || typeof parsedInput !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }

  const { quickPickId } = parsedInput as Record<string, unknown>;

  if (quickPickId === undefined) {
    throw MISSING_REQUIRED_PARAMETERS(['quickPickId']);
  }

  if (typeof quickPickId !== 'string') {
    throw INVALID_INPUT_ERROR('quickPickId must be a string');
  }

  if (!input.secrets) {
    throw new Error('No secrets provided in input');
  }

  return {
    quickPickId,
    secrets: input.secrets,
  };
}
