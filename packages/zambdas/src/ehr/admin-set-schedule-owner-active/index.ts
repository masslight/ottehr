import { APIGatewayProxyResult } from 'aws-lambda';
import { Location, Practitioner, Schedule } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, Secrets } from 'utils';
import { z } from 'zod';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  safeJsonParse,
  safeValidate,
  wrapHandler,
  ZambdaInput,
} from '../../shared';

interface AdminSetScheduleOwnerActiveInput {
  secrets: Secrets | null;
  scheduleId: string;
  active: boolean;
}

const ZAMBDA_NAME = 'admin-set-schedule-owner-active';
let m2mToken: string;

const SetScheduleOwnerActiveSchema = z.object({
  scheduleId: z.string().min(1, '"scheduleId" is required'),
  active: z.boolean(),
});

const validateRequestParameters = (input: ZambdaInput): AdminSetScheduleOwnerActiveInput => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  const parsed = safeValidate(SetScheduleOwnerActiveSchema, safeJsonParse(input.body));
  return { secrets: input.secrets, scheduleId: parsed.scheduleId, active: parsed.active };
};

/**
 * Toggle the active state of a Schedule's owner (Location or Practitioner).
 * Server-side owner resolution lets the client stay agnostic to which FHIR
 * field carries "active" per actor type:
 *   - Location owner → patch `.status` to 'active' | 'inactive'
 *   - Practitioner owner → patch `.active` to boolean
 *
 * PractitionerRole-owned Schedules must go through
 * `admin-set-practitioner-role-active` — it handles PR-specific concerns
 * (conflict re-check on reactivation, Schedule.active mirroring) that don't
 * apply to Location/Practitioner owners. Rejecting them here keeps the
 * separation explicit rather than papering over it with silent duplication.
 *
 * HealthcareService-owned Schedules aren't a supported shape in this
 * codebase (Groups don't own their own Schedules — their availability is
 * aggregated from member PR Schedules). Reject rather than guess.
 *
 * Mirrors the client-side patch previously issued from ScheduleGeneralTab
 * so the move to a zambda is behavior-preserving. Returns the derived
 * post-patch `active` boolean so the caller doesn't have to re-read the
 * owner's field itself.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const parsed = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parsed.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, parsed.secrets);

  const schedule = await oystehr.fhir.get<Schedule>({ resourceType: 'Schedule', id: parsed.scheduleId });
  const actorRef = schedule.actor?.[0]?.reference;
  if (!actorRef) {
    throw INVALID_INPUT_ERROR(`Schedule/${parsed.scheduleId} has no actor reference; cannot resolve owner.`);
  }
  const [ownerType, ownerId] = actorRef.split('/');
  if (!ownerType || !ownerId) {
    throw INVALID_INPUT_ERROR(`Schedule/${parsed.scheduleId} has malformed actor reference: "${actorRef}".`);
  }

  if (ownerType === 'PractitionerRole') {
    throw INVALID_INPUT_ERROR(
      'PractitionerRole-owned Schedules must be toggled via admin-set-practitioner-role-active. ' +
        'That path runs the reactivation conflict-check and mirrors Schedule.active, both of ' +
        'which are load-bearing for the PR flow and out of scope for this endpoint.'
    );
  }
  if (ownerType === 'HealthcareService') {
    throw INVALID_INPUT_ERROR(
      'HealthcareService-owned Schedules are not supported by admin-set-schedule-owner-active. ' +
        'Groups do not own their own Schedules in this data model; their availability is ' +
        'aggregated from member PractitionerRole Schedules.'
    );
  }
  if (ownerType !== 'Location' && ownerType !== 'Practitioner') {
    throw INVALID_INPUT_ERROR(`Unsupported Schedule actor type: "${ownerType}". Expected Location or Practitioner.`);
  }

  // Location's "active" is a status code with values beyond active/inactive
  // (`suspended` exists too). Mirroring the previous client-side behavior we
  // only round-trip between active <-> inactive here; a suspended Location
  // being flipped to active loses the suspended state, which matches
  // pre-migration behavior. If we ever need to preserve suspended, that
  // becomes a separate ticket — this zambda is a lift-and-shift.
  const value: string | boolean = ownerType === 'Location' ? (parsed.active ? 'active' : 'inactive') : parsed.active;
  const path = ownerType === 'Location' ? '/status' : '/active';

  try {
    await oystehr.fhir.patch<Location | Practitioner>({
      resourceType: ownerType,
      id: ownerId,
      operations: [{ op: 'add', path, value }],
    });
  } catch (err) {
    // Owner referenced by the Schedule but not present in FHIR is a data
    // anomaly worth surfacing as 404 rather than a generic 500. The SDK
    // throws a generic Error for a missing resource; check the message
    // shape and rethrow as the typed error.
    const message = err instanceof Error ? err.message : String(err);
    if (/not found/i.test(message)) throw FHIR_RESOURCE_NOT_FOUND(ownerType);
    throw err;
  }

  // The patch either applied cleanly or threw — no third state. Reflect the
  // requested value rather than parsing it back out of the patched
  // resource. Practitioner is the load-bearing case: some FHIR servers
  // strip `active: true` from response bodies (`active` defaults to true,
  // so it's semantically redundant), which would cause a naive
  // `updated.active === true` read to return `false` on the reactivation
  // path. Location has the same shape argument in reverse — we just wrote
  // 'active' or 'inactive', there's no ambiguity to re-derive.
  return {
    statusCode: 200,
    body: JSON.stringify({
      active: parsed.active,
      owner: { resourceType: ownerType, id: ownerId },
    }),
  };
});
