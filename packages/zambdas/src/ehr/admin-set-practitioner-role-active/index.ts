import { APIGatewayProxyResult } from 'aws-lambda';
import { Schedule } from 'fhir/r4b';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS, Secrets } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';

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

// Sets PractitionerRole.active (and every Schedule whose actor is the PR) to
// the requested value. Used both to soft-delete a schedule (active=false) and
// to bring a previously deactivated one back into circulation (active=true).
//
// Past Appointments / Encounters may reference these resources, so we never
// hard-delete — toggling active is enough to add or remove them from admin
// lists, conflict checks, and group member resolution, which all filter on
// active=true.
//
// On deactivation we patch Schedule.active first, then the PR, so the
// load-bearing PR-level filter only flips after the schedules are out of
// circulation. On activation the order doesn't matter for correctness, but we
// keep it consistent (schedules first) for symmetry.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const parsed = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parsed.secrets);
  const oystehr = createOystehrClient(m2mToken, parsed.secrets);

  const scheduleBundle = await oystehr.fhir.search<Schedule>({
    resourceType: 'Schedule',
    params: [{ name: 'actor', value: `PractitionerRole/${parsed.roleId}` }],
  });
  const schedules = scheduleBundle.unbundle();
  for (const s of schedules) {
    if (!s.id) continue;
    await oystehr.fhir.patch({
      resourceType: 'Schedule',
      id: s.id,
      operations: [{ op: 'add', path: '/active', value: parsed.active }],
    });
  }

  await oystehr.fhir.patch({
    resourceType: 'PractitionerRole',
    id: parsed.roleId,
    operations: [{ op: 'add', path: '/active', value: parsed.active }],
  });

  return { statusCode: 200, body: JSON.stringify({ updatedScheduleCount: schedules.length, active: parsed.active }) };
});
