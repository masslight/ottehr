import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService, PractitionerRole, Schedule } from 'fhir/r4b';
import {
  FHIR_RESOURCE_NOT_FOUND,
  getPractitionerRoleAllCategories,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  PRACTITIONER_SCHEDULE_CONFLICT_ERROR,
  Secrets,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { checkPractitionerRoleConflict } from '../admin-practitioner-role-shared/check-conflict';

interface AdminSetPractitionerRoleActiveInput {
  secrets: Secrets | null;
  roleId: string;
  active: boolean;
}

const ZAMBDA_NAME = 'admin-set-practitioner-role-active';
let m2mToken: string;

const validateRequestParameters = (input: ZambdaInput): AdminSetPractitionerRoleActiveInput => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  let parsed: { roleId?: unknown; active?: unknown };
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body must be valid JSON');
  }
  const missing: string[] = [];
  if (!parsed.roleId) missing.push('roleId');
  if (typeof parsed.active !== 'boolean') missing.push('active');
  if (missing.length) throw MISSING_REQUIRED_PARAMETERS(missing);
  if (typeof parsed.roleId !== 'string') throw INVALID_INPUT_ERROR('"roleId" must be a string');
  return { secrets: input.secrets, roleId: parsed.roleId, active: parsed.active as boolean };
};

// Sets PractitionerRole.active and the active flag of its single attached
// Schedule to the requested value. Used both to soft-delete a schedule
// (active=false) and to bring a previously deactivated one back into
// circulation (active=true).
//
// Past Appointments / Encounters may reference these resources, so we never
// hard-delete — toggling active is enough to add or remove them from admin
// lists, conflict checks, and group member resolution, which all filter on
// active=true.
//
// On deactivation we patch Schedule.active first, then the PR, so the
// load-bearing PR-level filter only flips after the schedule is out of
// circulation. On activation the order doesn't matter for correctness, but we
// keep it consistent (schedule first) for symmetry.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const parsed = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parsed.secrets);
  const oystehr = createOystehrClient(m2mToken, parsed.secrets);

  // Our scheduling model attaches exactly one Schedule to each PractitionerRole.
  // Bail rather than guess if the data is in any other shape: zero means the
  // PR doesn't have a Schedule to toggle (treat as not-found), more than one
  // means we can't unambiguously pick which to act on. Both cases are server
  // data anomalies, not normal flows.
  const scheduleBundle = await oystehr.fhir.search<Schedule>({
    resourceType: 'Schedule',
    params: [{ name: 'actor', value: `PractitionerRole/${parsed.roleId}` }],
  });
  const schedules = scheduleBundle.unbundle().filter((s): s is Schedule & { id: string } => !!s.id);
  if (schedules.length === 0) {
    throw FHIR_RESOURCE_NOT_FOUND('Schedule');
  }
  if (schedules.length > 1) {
    throw new Error(
      `Expected exactly 1 Schedule with actor PractitionerRole/${parsed.roleId}, found ${schedules.length}. ` +
        `Refusing to act on ambiguous data.`
    );
  }
  const schedule = schedules[0];

  // Activation can re-introduce the duplicate-coverage problem the
  // create/update conflict guard exists to prevent: deactivate A, create an
  // overlapping B (which passes its own check because A is inactive), then
  // reactivate A and now both are active for the same
  // (practitioner, location, category) tuple. Run the same guard before
  // flipping active back to true. Deactivation can never create a new
  // conflict, so we only need it on the activation path.
  if (parsed.active) {
    const role = await oystehr.fhir.get<PractitionerRole>({
      resourceType: 'PractitionerRole',
      id: parsed.roleId,
    });
    const practitionerRef = role.practitioner?.reference;
    const locationRef = role.location?.[0]?.reference;
    const categoryHsIds = (role.healthcareService ?? [])
      .map((ref) => ref.reference?.split('/')[1])
      .filter((id): id is string => !!id);
    const allCategories = getPractitionerRoleAllCategories(role);

    if (practitionerRef && locationRef && (categoryHsIds.length > 0 || allCategories)) {
      const categoryNameById = new Map<string, string>();
      if (categoryHsIds.length > 0) {
        const hsBundle = await oystehr.fhir.search<HealthcareService>({
          resourceType: 'HealthcareService',
          params: [{ name: '_id', value: categoryHsIds.join(',') }],
        });
        for (const hs of hsBundle.unbundle()) {
          if (hs.id) categoryNameById.set(hs.id, hs.name ?? hs.id);
        }
      }
      const conflict = await checkPractitionerRoleConflict(
        oystehr,
        {
          id: parsed.roleId,
          practitionerRef,
          locationRef,
          categoryHsIds,
          allCategories,
        },
        { categoryNameById }
      );
      if (conflict) {
        throw PRACTITIONER_SCHEDULE_CONFLICT_ERROR(conflict.conflictingCategoryNames);
      }
    }
  }

  await oystehr.fhir.patch({
    resourceType: 'Schedule',
    id: schedule.id,
    operations: [{ op: 'add', path: '/active', value: parsed.active }],
  });

  await oystehr.fhir.patch({
    resourceType: 'PractitionerRole',
    id: parsed.roleId,
    operations: [{ op: 'add', path: '/active', value: parsed.active }],
  });

  return { statusCode: 200, body: JSON.stringify({ active: parsed.active }) };
});
