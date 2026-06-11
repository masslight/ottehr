import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { FhirResource, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import {
  GetScheduleResponse,
  SCHEDULE_EXTENSION_URL,
  SCHEDULE_NOT_FOUND_ERROR,
  SLUG_SYSTEM,
  TIMEZONE_EXTENSION_URL,
} from 'utils';
import { afterAll, assert, beforeAll, describe, expect, inject, test } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import { buildSimpleScheduleExt, cleanupTestScheduleResources, persistSchedule } from '../helpers/testScheduleUtils';

// Locks in the fix for "deleted schedules still vend slots when the booking
// URL is navigated to": the EHR-side schedule "delete" path marks the owner
// (and/or the Schedule resource itself) as inactive rather than
// hard-deleting. Without filters at the getSchedules level, the slug still
// resolves and the public booking endpoint happily produces slots against
// the soft-deleted record.
//
// Two filters layered in getSchedules:
//   - Owner-active filter (FHIR search param) — branches by resource type
//     because Location uses `status` while PractitionerRole/HealthcareService
//     use the `active` boolean.
//   - Schedule.active filter (in-code on the returned bundle) — catches the
//     case where the owner is still active but the Schedule resource itself
//     was deactivated.
//
// Each test pairs a positive control (active fixture → booking URL resolves)
// with the negative case (flip the relevant field to inactive → expect
// SCHEDULE_NOT_FOUND). Covers Location-actored and PractitionerRole-actored
// — the two surfaces an admin can "delete" through the EHR UI.
describe('get-schedule filters out inactive owners and Schedules', () => {
  let oystehr: Oystehr;
  let token: string | null = null;
  let processId: string | null = null;
  // Resources `cleanupTestScheduleResources` doesn't sweep. It only deletes
  // Schedule + the Schedule's direct `_include`d actor; for PR-actored
  // fixtures the actor is the PR, so PR + Practitioner + Location all leak
  // unless tracked explicitly here.
  const extraResourceCleanup: Array<{ resourceType: 'Practitioner' | 'PractitionerRole' | 'Location'; id: string }> =
    [];

  beforeAll(async () => {
    processId = randomUUID();
    const { AUTH0_ENDPOINT, AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;
    const EXECUTE_ZAMBDA_URL = inject('EXECUTE_ZAMBDA_URL');
    expect(EXECUTE_ZAMBDA_URL).toBeDefined();
    token = await getAuth0Token({
      AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT_TESTS,
      AUTH0_SECRET: AUTH0_SECRET_TESTS,
      AUTH0_AUDIENCE,
    });
    oystehr = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectApiUrl: EXECUTE_ZAMBDA_URL,
      services: { zambdaApiUrl: EXECUTE_ZAMBDA_URL },
      projectId: PROJECT_ID,
    });
  });

  afterAll(async () => {
    // Throw rather than silently no-op so a setup failure can't leave tagged
    // fixtures behind unnoticed — matches cleanupTestScheduleResources' own
    // convention.
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null; cannot clean up fixtures');
    }
    await cleanupTestScheduleResources(processId, oystehr);
    for (const { resourceType, id } of extraResourceCleanup) {
      try {
        await oystehr.fhir.delete({ resourceType, id });
      } catch (e) {
        console.error(`Failed to delete fixture ${resourceType}/${id}:`, e);
      }
    }
  });

  // get-schedule throws via the standard zambda error path. The SDK surfaces
  // that as a thrown error whose `.code` is the body's `code` field.
  const expectScheduleNotFound = (err: unknown): void => {
    const e = err as { code?: number; message?: string };
    expect(e?.code).toBe(SCHEDULE_NOT_FOUND_ERROR.code);
  };

  interface LocationFixture {
    slug: string;
    location: Location;
    schedule: Schedule;
  }
  const createLocationFixture = async (): Promise<LocationFixture> => {
    assert(processId);
    const slug = `inactive-loc-${randomUUID().slice(0, 8)}`;
    const ownerLocation: Location = {
      resourceType: 'Location',
      status: 'active',
      name: 'Inactive-Test Location',
      identifier: [{ system: SLUG_SYSTEM, value: slug }],
      address: {
        use: 'work',
        type: 'physical',
        line: ['1 Test St'],
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
      },
    };
    const { schedule, owner } = await persistSchedule(
      { scheduleExtension: buildSimpleScheduleExt(), processId, scheduleOwner: ownerLocation },
      oystehr
    );
    assert(schedule.id);
    assert(owner);
    return { slug, location: owner as Location, schedule };
  };

  interface PrFixture {
    slug: string;
    location: Location;
    practitioner: Practitioner;
    pr: PractitionerRole;
    schedule: Schedule;
  }
  const createPrFixture = async (): Promise<PrFixture> => {
    assert(processId);
    const slug = `inactive-pr-${randomUUID().slice(0, 8)}`;
    const locationUrn = `urn:uuid:${randomUUID()}`;
    const practitionerUrn = `urn:uuid:${randomUUID()}`;
    const prUrn = `urn:uuid:${randomUUID()}`;
    const tag = { system: 'OTTEHR_AUTOMATED_TEST', code: `DELETE_ME-${processId}` };

    const requests: BatchInputRequest<FhirResource>[] = [
      {
        method: 'POST',
        url: 'Location',
        fullUrl: locationUrn,
        resource: { resourceType: 'Location', status: 'active', name: 'PR Test Location', meta: { tag: [tag] } },
      } as BatchInputPostRequest<Location>,
      {
        method: 'POST',
        url: 'Practitioner',
        fullUrl: practitionerUrn,
        resource: {
          resourceType: 'Practitioner',
          name: [{ family: 'Test', given: ['Provider'] }],
          meta: { tag: [tag] },
        },
      } as BatchInputPostRequest<Practitioner>,
      {
        method: 'POST',
        url: 'PractitionerRole',
        fullUrl: prUrn,
        resource: {
          resourceType: 'PractitionerRole',
          active: true,
          practitioner: { reference: practitionerUrn },
          location: [{ reference: locationUrn }],
          identifier: [{ system: SLUG_SYSTEM, value: slug }],
          meta: { tag: [tag] },
        },
      } as BatchInputPostRequest<PractitionerRole>,
      {
        method: 'POST',
        url: 'Schedule',
        resource: {
          resourceType: 'Schedule',
          actor: [{ reference: prUrn }],
          extension: [
            { url: TIMEZONE_EXTENSION_URL, valueString: 'America/New_York' },
            { url: SCHEDULE_EXTENSION_URL, valueString: JSON.stringify(buildSimpleScheduleExt()) },
          ],
          meta: { tag: [tag] },
        },
      } as BatchInputPostRequest<Schedule>,
    ];

    const tx = await oystehr.fhir.transaction({ requests });
    const created = (tx.entry ?? []).map((e) => e.resource).filter((r): r is FhirResource => !!r);
    const location = created.find((r): r is Location => r.resourceType === 'Location');
    const practitioner = created.find((r): r is Practitioner => r.resourceType === 'Practitioner');
    const pr = created.find((r): r is PractitionerRole => r.resourceType === 'PractitionerRole');
    const schedule = created.find((r): r is Schedule => r.resourceType === 'Schedule');
    assert(location?.id);
    assert(practitioner?.id);
    assert(pr?.id);
    assert(schedule?.id);
    // PR-actored fixture: the Schedule's `_include`d actor is the PR, so
    // cleanupTestScheduleResources sweeps the PR but not the PR's referenced
    // Practitioner or Location. Track those for the afterAll pass.
    extraResourceCleanup.push({ resourceType: 'Practitioner', id: practitioner.id });
    extraResourceCleanup.push({ resourceType: 'Location', id: location.id });
    return { slug, location, practitioner, pr, schedule };
  };

  const callGetSchedule = async (
    slug: string,
    scheduleType: 'location' | 'provider'
  ): Promise<{ ok: true; output: GetScheduleResponse } | { ok: false; error: unknown }> => {
    try {
      const res = await oystehr.zambda.executePublic({ id: 'get-schedule', slug, scheduleType });
      return { ok: true, output: res.output as GetScheduleResponse };
    } catch (e) {
      return { ok: false, error: e };
    }
  };

  test('Location owner with status="inactive" — booking URL fails with SCHEDULE_NOT_FOUND', async () => {
    const fixture = await createLocationFixture();

    // Positive control: while the Location is active, the booking URL resolves.
    const before = await callGetSchedule(fixture.slug, 'location');
    expect(before.ok).toBe(true);

    // Soft-delete the Location.
    await oystehr.fhir.patch<Location>({
      resourceType: 'Location',
      id: fixture.location.id!,
      operations: [{ op: 'replace', path: '/status', value: 'inactive' }],
    });

    const after = await callGetSchedule(fixture.slug, 'location');
    expect(after.ok).toBe(false);
    if (!after.ok) expectScheduleNotFound(after.error);
  });

  test('Location-actored Schedule with active=false — booking URL fails with SCHEDULE_NOT_FOUND', async () => {
    const fixture = await createLocationFixture();

    // Positive control mirrors the prior test; included to prove this
    // fixture is bookable before the per-Schedule deactivation, so the
    // negative case isn't a flake.
    const before = await callGetSchedule(fixture.slug, 'location');
    expect(before.ok).toBe(true);

    // Owner stays active; deactivate the Schedule resource itself. Mirrors
    // an admin "delete schedule" that toggles Schedule.active rather than
    // the owner's status.
    await oystehr.fhir.patch<Schedule>({
      resourceType: 'Schedule',
      id: fixture.schedule.id!,
      operations: [{ op: 'add', path: '/active', value: false }],
    });

    const after = await callGetSchedule(fixture.slug, 'location');
    expect(after.ok).toBe(false);
    if (!after.ok) expectScheduleNotFound(after.error);
  });

  test('PractitionerRole owner with active=false — booking URL fails with SCHEDULE_NOT_FOUND', async () => {
    const fixture = await createPrFixture();

    const before = await callGetSchedule(fixture.slug, 'provider');
    expect(before.ok).toBe(true);

    await oystehr.fhir.patch<PractitionerRole>({
      resourceType: 'PractitionerRole',
      id: fixture.pr.id!,
      operations: [{ op: 'replace', path: '/active', value: false }],
    });

    const after = await callGetSchedule(fixture.slug, 'provider');
    expect(after.ok).toBe(false);
    if (!after.ok) expectScheduleNotFound(after.error);
  });

  test('PractitionerRole-actored Schedule with active=false — booking URL fails with SCHEDULE_NOT_FOUND', async () => {
    const fixture = await createPrFixture();

    const before = await callGetSchedule(fixture.slug, 'provider');
    expect(before.ok).toBe(true);

    await oystehr.fhir.patch<Schedule>({
      resourceType: 'Schedule',
      id: fixture.schedule.id!,
      operations: [{ op: 'add', path: '/active', value: false }],
    });

    const after = await callGetSchedule(fixture.slug, 'provider');
    expect(after.ok).toBe(false);
    if (!after.ok) expectScheduleNotFound(after.error);
  });
});
