import { Secrets, UpdateLabOrderResourceParams, VALID_LAB_ORDER_UPDATE_EVENTS } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): UpdateLabOrderResourceParams & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  let params: UpdateLabOrderResourceParams;

  try {
    params = JSON.parse(input.body);
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }

  const { taskId, event } = params;

  if (typeof taskId !== 'string') {
    throw new Error('Invalid parameter type: taskId must be a string');
  }

  if (!event || !VALID_LAB_ORDER_UPDATE_EVENTS.includes(event)) {
    throw new Error(
      `Invalid parameter: event must be "${VALID_LAB_ORDER_UPDATE_EVENTS.join('", "')}", received "${event}"`
    );
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return {
    taskId,
    event,
    secrets: input.secrets,
    userToken,
  };
}
