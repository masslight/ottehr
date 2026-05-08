import { APIGatewayProxyResult } from 'aws-lambda';
import { Schedule } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';

interface AdminDeletePractitionerRoleInput {
  roleId: string;
}

const ZAMBDA_NAME = 'admin-delete-practitioner-role';
let m2mToken: string;

// Soft-delete: set active=false on the PR and on every Schedule whose actor is
// the PR. Past Appointments / Encounters may reference these resources, so we
// don't hard-delete — we just take them out of active circulation. The admin
// list query filters by active=true, so deactivated rows disappear from the UI
// but historical references remain valid.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw new Error('No request body provided');
  if (!input.secrets) throw new Error('No secrets provided');
  const parsed = JSON.parse(input.body) as Partial<AdminDeletePractitionerRoleInput>;
  if (!parsed.roleId || typeof parsed.roleId !== 'string') {
    throw new Error('roleId is required');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(m2mToken, input.secrets);

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
