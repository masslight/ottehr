import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, PractitionerRole, Schedule } from 'fhir/r4b';
import {
  APIError,
  APIErrorCode,
  DeleteLocationResponse,
  FHIR_RESOURCE_NOT_FOUND,
  getAllFhirSearchPages,
  MISSING_REQUEST_BODY,
  RESOURCE_HAS_DEPENDENTS_ERROR,
  RoleType,
  Secrets,
  userMe,
} from 'utils';
import { z } from 'zod';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  safeJsonParse,
  safeValidate,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

const ZAMBDA_NAME = 'delete-location';
let m2mToken: string;

const ALLOWED_CALLER_ROLES: string[] = [RoleType.Administrator, RoleType.CustomerSupport];

const DeleteLocationSchema = z.object({
  locationId: z.string().min(1, '"locationId" is required'),
  force: z.boolean().optional().default(false),
});

/**
 * Guarded hard-delete for a Location — Admin / Customer Support only.
 *
 * Deactivation (toggle-location-active) is the routine "archive" control and stays the
 * default; this is the escape hatch for a Location created in error. Two-phase:
 *   1. `force: false` (the first attempt) — if the Location has dependent Schedules /
 *      PractitionerRoles or any Appointments, the delete is refused with
 *      RESOURCE_HAS_DEPENDENTS so the UI can show a destructive-action warning.
 *   2. `force: true` — proceed: cascade-delete the dependent Schedules + PRs (which
 *      would otherwise dangle), then the Location. Appointments are never deleted
 *      (clinical history is kept); on a forced delete their location reference is left
 *      orphaned.
 *
 * NOTE: if Oystehr enforces referential integrity on delete, a Location still
 * referenced by Appointments can't actually be removed; that case is caught and
 * surfaced as a clear "deactivate instead" error rather than a raw FHIR conflict.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.headers.Authorization) {
    throw {
      code: APIErrorCode.MISSING_AUTH_TOKEN,
      message: 'Authorization header is required',
      statusCode: 401,
    } satisfies APIError;
  }

  const { locationId, force } = safeValidate(DeleteLocationSchema, safeJsonParse(input.body));
  const callerToken = input.headers.Authorization.replace(/^Bearer\s+/i, '');
  const { secrets } = input;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  await assertCallerAuthorized(callerToken, secrets);

  // Confirm the Location exists first — a clear 404 beats a confusing empty cascade.
  try {
    await oystehr.fhir.get({ resourceType: 'Location', id: locationId });
  } catch (err) {
    if (/not found/i.test(err instanceof Error ? err.message : String(err))) {
      throw FHIR_RESOURCE_NOT_FOUND('Location');
    }
    throw err;
  }

  const [schedules, practitionerRoles, appointments] = await Promise.all([
    getAllFhirSearchPages<Schedule>(
      { resourceType: 'Schedule', params: [{ name: 'actor', value: `Location/${locationId}` }] },
      oystehr
    ),
    getAllFhirSearchPages<PractitionerRole>(
      { resourceType: 'PractitionerRole', params: [{ name: 'location', value: `Location/${locationId}` }] },
      oystehr
    ),
    getAllFhirSearchPages<Appointment>(
      { resourceType: 'Appointment', params: [{ name: 'actor', value: `Location/${locationId}` }] },
      oystehr
    ),
  ]);

  const dependents = {
    schedules: schedules.length,
    practitionerRoles: practitionerRoles.length,
    appointments: appointments.length,
  };
  const hasDependents = dependents.schedules > 0 || dependents.practitionerRoles > 0 || dependents.appointments > 0;

  if (hasDependents && !force) {
    throw RESOURCE_HAS_DEPENDENTS_ERROR(dependents);
  }

  // Cascade in dependency order: Schedules + PRs (both reference the Location) before
  // the Location itself. Appointments are intentionally left in place.
  for (const schedule of schedules) {
    await oystehr.fhir.delete({ resourceType: 'Schedule', id: schedule.id! });
  }
  for (const role of practitionerRoles) {
    await oystehr.fhir.delete({ resourceType: 'PractitionerRole', id: role.id! });
  }

  try {
    await oystehr.fhir.delete({ resourceType: 'Location', id: locationId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (dependents.appointments > 0 && /reference|conflict|integrity|in use|constraint/i.test(message)) {
      throw {
        code: APIErrorCode.RESOURCE_HAS_DEPENDENTS,
        message:
          `This location can't be deleted because ${dependents.appointments} appointment` +
          `${dependents.appointments === 1 ? '' : 's'} still reference it. Deactivate it instead.`,
        statusCode: 409,
      } satisfies APIError;
    }
    throw err;
  }

  const response: DeleteLocationResponse = {
    deleted: true,
    id: locationId,
    cascaded: { schedules: dependents.schedules, practitionerRoles: dependents.practitionerRoles },
    orphanedAppointments: dependents.appointments,
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});

const assertCallerAuthorized = async (token: string, secrets: Secrets | null): Promise<void> => {
  const caller = await userMe(token, secrets);
  const callerRoles = caller.roles?.map((role) => role.name) ?? [];
  if (!callerRoles.some((role) => ALLOWED_CALLER_ROLES.includes(role))) {
    throw {
      code: APIErrorCode.NOT_AUTHORIZED,
      message: 'You are not permitted to delete locations.',
      statusCode: 403,
    } satisfies APIError;
  }
};
