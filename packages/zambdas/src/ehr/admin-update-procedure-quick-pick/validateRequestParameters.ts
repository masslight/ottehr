import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS, Secrets, UpdateProcedureQuickPickInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): UpdateProcedureQuickPickInput & { secrets: Secrets } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedInput = JSON.parse(input.body) as unknown;

  if (!parsedInput || typeof parsedInput !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }

  const { quickPickId, quickPick } = parsedInput as Record<string, unknown>;

  const missingFields = [];
  if (quickPickId === undefined) {
    missingFields.push('quickPickId');
  }
  if (quickPick === undefined) {
    missingFields.push('quickPick');
  }

  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  if (typeof quickPickId !== 'string') {
    throw INVALID_INPUT_ERROR('quickPickId must be a string');
  }

  if (typeof quickPick !== 'object' || quickPick === null) {
    throw INVALID_INPUT_ERROR('quickPick must be an object');
  }

  const qp = quickPick as Record<string, unknown>;

  if (!qp.name || typeof qp.name !== 'string') {
    throw INVALID_INPUT_ERROR('quickPick.name is required and must be a string');
  }

  if (!input.secrets) {
    throw new Error('No secrets provided in input');
  }

  return {
    quickPickId,
    quickPick: qp as UpdateProcedureQuickPickInput['quickPick'],
    secrets: input.secrets,
  };
}
