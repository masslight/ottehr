import { APIGatewayProxyResult } from 'aws-lambda';
import { Schedule } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND, MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  safeJsonParse,
  safeValidate,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

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
