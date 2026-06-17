import { APIGatewayProxyResult } from 'aws-lambda';
import { Schedule } from 'fhir/r4b';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS, Secrets } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  safeJsonParse,
  wrapHandler,
  ZambdaInput,
} from '../../shared';

interface AdminDeletePractitionerRoleInput {
  secrets: Secrets | null;
  roleId: string;
}

const ZAMBDA_NAME = 'admin-delete-practitioner-role';
let m2mToken: string;

const validateRequestParameters = (input: ZambdaInput): AdminDeletePractitionerRoleInput => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  let parsed: { roleId?: unknown };
  try {
    parsed = safeJsonParse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body must be valid JSON');
  }
  if (!parsed.roleId) throw MISSING_REQUIRED_PARAMETERS(['roleId']);
  if (typeof parsed.roleId !== 'string') throw INVALID_INPUT_ERROR('"roleId" must be a string');
  return { secrets: input.secrets, roleId: parsed.roleId };
};

// Soft-delete: set active=false on the PR and on every Schedule whose actor is
// the PR. Past Appointments / Encounters may reference these resources, so we
// don't hard-delete — we just take them out of active circulation. The admin
// list query filters by active=true, so deactivated rows disappear from the UI
// but historical references remain valid.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const parsed = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parsed.secrets);
  const oystehr = createOystehrClient(m2mToken, parsed.secrets);

  // Deactivate any Schedule whose actor is this PR before deactivating the PR
  // itself. The PR-side filter (active=true) is the load-bearing mechanism
  // that hides a soft-deleted PR from admin lists, conflict checks, and group
  // member resolution — Schedule.active is patched here for completeness and
  // to keep the resource graph consistent.
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
      operations: [{ op: 'add', path: '/active', value: false }],
    });
  }

  await oystehr.fhir.patch({
    resourceType: 'PractitionerRole',
    id: parsed.roleId,
    operations: [{ op: 'add', path: '/active', value: false }],
  });

  return { statusCode: 200, body: JSON.stringify({ deactivatedScheduleCount: schedules.length }) };
});
