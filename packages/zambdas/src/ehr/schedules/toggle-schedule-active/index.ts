import { APIGatewayProxyResult } from 'aws-lambda';
import { Schedule } from 'fhir/r4b';
import { RoleType } from 'utils/lib/types/api/user.types';
import { APIErrorCode, FHIR_RESOURCE_NOT_FOUND, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { callerHasRole, checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const ZAMBDA_NAME = 'toggle-schedule-active';
let m2mToken: string;

const ToggleScheduleActiveSchema = z.object({
  scheduleId: z.string().min(1, '"scheduleId" is required'),
  active: z.boolean(),
});

/**
 * Sets a Schedule's active flag. Deactivating drops just this schedule from
 * booking (the shared getSchedules filter honors Schedule.active) while leaving
 * its owner and any other schedules the owner has intact. A dedicated toggle
 * endpoint, same pattern as toggle-location-active / toggle-group-active.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  const { scheduleId, active } = safeValidate(ToggleScheduleActiveSchema, safeJsonParse(input.body));
  const { secrets } = input;

  if (
    !(await callerHasRole(input.headers?.Authorization, secrets, [RoleType.Administrator, RoleType.CustomerSupport]))
  ) {
    throw {
      code: APIErrorCode.NOT_AUTHORIZED,
      message: "You are not permitted to change a schedule's active state.",
    };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  try {
    await oystehr.fhir.patch<Schedule>({
      resourceType: 'Schedule',
      id: scheduleId,
      operations: [{ op: 'add', path: '/active', value: active }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not found/i.test(message)) throw FHIR_RESOURCE_NOT_FOUND('Schedule');
    throw err;
  }

  return { statusCode: 200, body: JSON.stringify({ id: scheduleId, active }) };
});
