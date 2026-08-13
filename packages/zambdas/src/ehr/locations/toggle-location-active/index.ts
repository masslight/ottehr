import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { RoleType } from 'utils/lib/types/api/user.types';
import { APIErrorCode, FHIR_RESOURCE_NOT_FOUND, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { callerHasRole, checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const ZAMBDA_NAME = 'toggle-location-active';
let m2mToken: string;

const ToggleLocationActiveSchema = z.object({
  locationId: z.string().min(1, '"locationId" is required'),
  active: z.boolean(),
});

/**
 * Sets a Location's active state (`status` active <-> inactive) — the v1 "archive"
 * control, deliberately separate from update-location so it can carry its own
 * permission boundary and activation/deactivation side effects (e.g. cancelling
 * future appointments, re-checking conflicts) without entangling field-edit logic.
 * Deactivation is a soft-delete: the resource is kept (no dangling references), and
 * both booking paths already exclude inactive Locations.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  const { locationId, active } = safeValidate(ToggleLocationActiveSchema, safeJsonParse(input.body));
  const { secrets } = input;

  if (
    !(await callerHasRole(input.headers?.Authorization, secrets, [RoleType.Administrator, RoleType.CustomerSupport]))
  ) {
    throw {
      code: APIErrorCode.NOT_AUTHORIZED,
      message: "You are not permitted to change a location's active state.",
    };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const status = active ? 'active' : 'inactive';
  try {
    await oystehr.fhir.patch<Location>({
      resourceType: 'Location',
      id: locationId,
      operations: [{ op: 'add', path: '/status', value: status }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not found/i.test(message)) throw FHIR_RESOURCE_NOT_FOUND('Location');
    throw err;
  }

  return { statusCode: 200, body: JSON.stringify({ id: locationId, status }) };
});
