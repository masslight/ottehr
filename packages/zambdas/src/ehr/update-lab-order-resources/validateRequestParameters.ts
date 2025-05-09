import { Secrets, UpdateLabOrderResourcesParameters, LAB_ORDER_UPDATE_RESOURCES_EVENTS } from 'utils';
import { ZambdaInput } from '../../shared';
import { DateTime } from 'luxon';

export function validateRequestParameters(
  input: ZambdaInput
): UpdateLabOrderResourcesParameters & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: UpdateLabOrderResourcesParameters;

  try {
    params = JSON.parse(input.body);
  } catch (error) {
    throw Error('Invalid JSON in request body');
  }

  if (!Object.values(LAB_ORDER_UPDATE_RESOURCES_EVENTS).includes(params.event)) {
    throw Error(
      `Invalid parameter: event must be "${Object.values(LAB_ORDER_UPDATE_RESOURCES_EVENTS).join('", "')}", received "${
        params.event
      }"`
    );
  }

  if (params.event === 'reviewed') {
    const { taskId, serviceRequestId, diagnosticReportId, event } = params;

    if (typeof taskId !== 'string') {
      throw Error('Invalid parameter type: taskId must be a string');
    }

    if (typeof serviceRequestId !== 'string') {
      throw Error('Invalid parameter type: serviceRequestId must be a string');
    }

    if (typeof diagnosticReportId !== 'string') {
      throw Error('Invalid parameter type: diagnosticReportId must be a string');
    }

    return {
      serviceRequestId,
      diagnosticReportId,
      taskId,
      event,
      secrets,
      userToken,
    };
  } else if (params.event === 'specimenDateChanged') {
    const { serviceRequestId, specimenId, date, event } = params;

    if (!DateTime.fromISO(date).isValid) {
      throw Error('Invalid parameter: date must be a valid ISO 8601 date string');
    }

    if (typeof serviceRequestId !== 'string') {
      throw Error(`Invalid parameter type: serviceRequestId must be a string, received: ${typeof serviceRequestId}`);
    }

    if (typeof specimenId !== 'string') {
      throw Error(`Invalid parameter type: specimenId must be a string, received: ${typeof specimenId}`);
    }

    return {
      serviceRequestId,
      specimenId,
      date,
      event,
      secrets,
      userToken,
    };
  }

  throw Error('event is not supported');
}
