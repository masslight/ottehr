import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { isValidSlug, ScheduleStrategyCoding, SLUG_SYSTEM, slugFromName } from 'utils/lib/fhir/constants';
import { groupCharacteristics } from 'utils/lib/fhir/healthcareService';
import { CreateProviderGroupParams } from 'utils/lib/types/api/schedules';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const ZAMBDA_NAME = 'admin-create-group';
let m2mToken: string;

const CreateGroupSchema = z.object({
  name: z.string().trim().min(1, '"name" is required'),
  allLocations: z.boolean(),
  locationIds: z.array(z.string()).optional(),
});

/**
 * Creates a Provider group (a pooling HealthcareService) in the canonical shape —
 * name + slug + groupCharacteristics (assignmentMode + allLocations) + the
 * `pools-providers` strategy, plus `.location[]` when scoped. Services, members,
 * assignment mode, and the booking link are configured afterward via
 * admin-update-group. Sibling to admin-update-group so the client never has to
 * hand-build a group resource.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  const { name, allLocations, locationIds } = safeValidate(
    CreateGroupSchema,
    safeJsonParse(input.body)
  ) as unknown as CreateProviderGroupParams;
  const { secrets } = input;

  const trimmedName = name.trim();
  const slug = slugFromName(trimmedName);
  if (!isValidSlug(slug)) {
    throw INVALID_INPUT_ERROR('Cannot derive a URL-safe permalink from this name; use letters, digits, or hyphens.');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const group: HealthcareService = {
    resourceType: 'HealthcareService',
    active: true,
    name: trimmedName,
    identifier: [{ system: SLUG_SYSTEM, value: slug }],
    characteristic: [
      ...groupCharacteristics({ assignmentMode: 'anonymous', allLocations }),
      {
        coding: [
          {
            system: ScheduleStrategyCoding.poolsProviders.system,
            code: ScheduleStrategyCoding.poolsProviders.code,
            display: ScheduleStrategyCoding.poolsProviders.display,
          },
        ],
      },
    ],
    ...(!allLocations && locationIds && locationIds.length > 0
      ? { location: locationIds.map((id) => ({ reference: `Location/${id}` })) }
      : {}),
  };
  const created = await oystehr.fhir.create<HealthcareService>(group);

  return { statusCode: 200, body: JSON.stringify(created) };
});
