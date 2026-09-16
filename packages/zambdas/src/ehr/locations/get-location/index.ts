import { APIGatewayProxyResult } from 'aws-lambda';
import { Location, Schedule } from 'fhir/r4b';
import { SCHEDULE_DISPLAY_NAME_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { GetLocationResponse } from 'utils/lib/types/api/locations';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const ZAMBDA_NAME = 'get-location';
let m2mToken: string;

const GetLocationSchema = z.object({
  locationId: z.string().min(1, '"locationId" is required'),
});

/**
 * Returns a Location by id, plus the Schedules it actors — the read half of pure Location CRUD.
 *
 * The schedules ride along rather than being a second endpoint because no caller wants one without
 * the other: the Location supplies a booking link's identity and modes, and the presence of a
 * Schedule is what decides whether that link vends any times. Splitting them would mean either two
 * round trips or a UI that can't distinguish a live link from a dead one.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  const { locationId } = safeValidate(GetLocationSchema, safeJsonParse(input.body));
  const { secrets } = input;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const [location, schedules] = await Promise.all([
    oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId }),
    getAllFhirSearchPages<Schedule>(
      { resourceType: 'Schedule', params: [{ name: 'actor', value: `Location/${locationId}` }] },
      oystehr
    ),
  ]);

  const response: GetLocationResponse = {
    location,
    schedules: schedules
      .filter((schedule): schedule is Schedule & { id: string } => !!schedule.id)
      .map((schedule) => ({
        id: schedule.id,
        name: schedule.extension?.find((ext) => ext.url === SCHEDULE_DISPLAY_NAME_EXTENSION_URL)?.valueString,
      })),
  };

  return { statusCode: 200, body: JSON.stringify(response) };
});
