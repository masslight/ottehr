import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { FhirResource, HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  GetScheduleResponse,
  HourOfDay,
  SCHEDULE_EXTENSION_URL,
  SCHEDULE_NOT_FOUND_ERROR,
  ScheduleStrategyCoding,
  SLUG_SYSTEM,
  TIMEZONE_EXTENSION_URL,
} from 'utils';
import { afterAll, assert, beforeAll, describe, expect, inject, test } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import {
  buildSimpleScheduleExt,
  cleanupTestScheduleResources,
  persistSchedule,
  startOfDayWithTimezone,
} from '../helpers/testScheduleUtils';

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
  // Schedule + the Schedule's direct `_include`d actor; PR-actored fixtures
  // get their PR swept that way, but the PR's referenced Practitioner /
  // Location and any HealthcareService (group) need explicit tracking here.
  const extraResourceCleanup: Array<{
    resourceType: 'Practitioner' | 'Location' | 'HealthcareService';
    id: string;
  }> = [];

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

  interface GroupFixture {
    slug: string;
    group: HealthcareService;
    location: Location;
    practitionerA: Practitioner;
    practitionerB: Practitioner;
    prA: PractitionerRole;
    prB: PractitionerRole;
    scheduleA: Schedule;
    scheduleB: Schedule;
  }
  // Single-Location, pools-providers group with two member PRs (each with
  // its own Practitioner + Schedule). Members are joined via the
  // `PR.healthcareService` back-reference path so the walker picks them up
  // without needing location-overlap setup.
  const createGroupFixture = async (): Promise<GroupFixture> => {
    assert(processId);
    const slug = `inactive-group-${randomUUID().slice(0, 8)}`;
    const locationUrn = `urn:uuid:${randomUUID()}`;
    const practitionerAUrn = `urn:uuid:${randomUUID()}`;
    const practitionerBUrn = `urn:uuid:${randomUUID()}`;
    const prAUrn = `urn:uuid:${randomUUID()}`;
    const prBUrn = `urn:uuid:${randomUUID()}`;
    const groupUrn = `urn:uuid:${randomUUID()}`;
    const tag = { system: 'OTTEHR_AUTOMATED_TEST', code: `DELETE_ME-${processId}` };

    const makePractitioner = (urn: string, family: string): BatchInputPostRequest<Practitioner> => ({
      method: 'POST',
      url: 'Practitioner',
      fullUrl: urn,
      resource: {
        resourceType: 'Practitioner',
        active: true,
        name: [{ family, given: ['Test'] }],
        meta: { tag: [tag] },
      },
    });
    const makePr = (urn: string, practitionerUrn: string): BatchInputPostRequest<PractitionerRole> => ({
      method: 'POST',
      url: 'PractitionerRole',
      fullUrl: urn,
      resource: {
        resourceType: 'PractitionerRole',
        active: true,
        practitioner: { reference: practitionerUrn },
        location: [{ reference: locationUrn }],
        healthcareService: [{ reference: groupUrn }],
        meta: { tag: [tag] },
      },
    });
    // Disjoint hour ranges per member: slot dedup picks one Schedule per
    // start time, so identical schedules would always surface the same id
    // (alphabetically-earlier wins ties) and Schedule-B's reference would
    // never appear even before deactivation. Splitting the day lets both
    // schedules' ids surface in the response, so the negative case has
    // a meaningful signal — a missing Schedule-B reference means the
    // inactive-Practitioner filter actually took effect.
    const makeSchedule = (
      prUrn: string,
      openHour: HourOfDay,
      closeHour: HourOfDay | 24
    ): BatchInputPostRequest<Schedule> => ({
      method: 'POST',
      url: 'Schedule',
      resource: {
        resourceType: 'Schedule',
        actor: [{ reference: prUrn }],
        extension: [
          { url: TIMEZONE_EXTENSION_URL, valueString: 'America/New_York' },
          {
            url: SCHEDULE_EXTENSION_URL,
            valueString: JSON.stringify(buildSimpleScheduleExt({ open: openHour, close: closeHour })),
          },
        ],
        meta: { tag: [tag] },
      },
    });

    const requests: BatchInputRequest<FhirResource>[] = [
      {
        method: 'POST',
        url: 'Location',
        fullUrl: locationUrn,
        resource: { resourceType: 'Location', status: 'active', name: 'Group Test Location', meta: { tag: [tag] } },
      } as BatchInputPostRequest<Location>,
      makePractitioner(practitionerAUrn, 'ProviderA'),
      makePractitioner(practitionerBUrn, 'ProviderB'),
      makePr(prAUrn, practitionerAUrn),
      makePr(prBUrn, practitionerBUrn),
      makeSchedule(prAUrn, 9, 12), // morning-only member
      makeSchedule(prBUrn, 13, 17), // afternoon-only member
      {
        method: 'POST',
        url: 'HealthcareService',
        fullUrl: groupUrn,
        resource: {
          resourceType: 'HealthcareService',
          active: true,
          name: 'Inactive-Test Group',
          identifier: [{ system: SLUG_SYSTEM, value: slug }],
          location: [{ reference: locationUrn }],
          characteristic: [
            {
              coding: [
                {
                  system: ScheduleStrategyCoding.poolsProviders.system,
                  code: ScheduleStrategyCoding.poolsProviders.code,
                },
              ],
            },
          ],
          meta: { tag: [tag] },
        },
      } as BatchInputPostRequest<HealthcareService>,
    ];

    const tx = await oystehr.fhir.transaction({ requests });
    const created = (tx.entry ?? []).map((e) => e.resource).filter((r): r is FhirResource => !!r);
    const location = created.find((r): r is Location => r.resourceType === 'Location');
    const practitioners = created.filter((r): r is Practitioner => r.resourceType === 'Practitioner');
    const prs = created.filter((r): r is PractitionerRole => r.resourceType === 'PractitionerRole');
    const schedules = created.filter((r): r is Schedule => r.resourceType === 'Schedule');
    const group = created.find((r): r is HealthcareService => r.resourceType === 'HealthcareService');
    assert(location?.id);
    assert(practitioners.length === 2);
    assert(prs.length === 2);
    assert(schedules.length === 2);
    assert(group?.id);

    // Identify A/B by the family name we wrote at create time. Transaction
    // response order is server-dependent and isn't guaranteed to match
    // request order, so indexing by `practitioners[0]/[1]` would let the
    // test silently swap which Practitioner gets deactivated under different
    // server orderings. The family name is the durable identity here.
    const practitionerA = practitioners.find((p) => p.name?.[0]?.family === 'ProviderA');
    const practitionerB = practitioners.find((p) => p.name?.[0]?.family === 'ProviderB');
    assert(practitionerA?.id);
    assert(practitionerB?.id);
    // Pair PR ↔ Practitioner ↔ Schedule by the reference chain rather than
    // array order.
    const prA = prs.find((r) => r.practitioner?.reference === `Practitioner/${practitionerA.id}`);
    const prB = prs.find((r) => r.practitioner?.reference === `Practitioner/${practitionerB.id}`);
    assert(prA?.id);
    assert(prB?.id);
    const scheduleA = schedules.find((s) => s.actor?.[0]?.reference === `PractitionerRole/${prA.id}`);
    const scheduleB = schedules.find((s) => s.actor?.[0]?.reference === `PractitionerRole/${prB.id}`);
    assert(scheduleA?.id);
    assert(scheduleB?.id);

    // PRs are swept by cleanupTestScheduleResources via the Schedule:actor
    // _include, so they're not tracked here (would just generate noisy
    // double-delete failures). Practitioners, Location, and the group HS
    // aren't on the Schedule.actor chain — they need explicit tracking.
    extraResourceCleanup.push({ resourceType: 'Practitioner', id: practitionerA.id });
    extraResourceCleanup.push({ resourceType: 'Practitioner', id: practitionerB.id });
    extraResourceCleanup.push({ resourceType: 'Location', id: location.id });
    extraResourceCleanup.push({ resourceType: 'HealthcareService', id: group.id });

    return {
      slug,
      group,
      location,
      practitionerA,
      practitionerB,
      prA,
      prB,
      scheduleA,
      scheduleB,
    };
  };

  // Narrow to scheduleTypes that don't need extra params. The group case
  // typically needs `selectedDate` to land slots in a future window and
  // (sometimes) `atLocationSlug`; group tests use their own inline caller
  // that passes those explicitly. Excluding 'group' here prevents a future
  // edit from calling this helper for a group and getting a confusing
  // empty-result or runtime error.
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

  test('Practitioner with active=false — provider booking URL fails with SCHEDULE_NOT_FOUND', async () => {
    // The third place a "provider" can be marked inactive: Employees >
    // Provider details (the Practitioner.active toggle). Distinct from the
    // PR or Schedule being inactive — the human is deactivated globally,
    // which should kill every booking URL that resolves to a Schedule whose
    // PR points at this Practitioner. This covers the PR-direct path; the
    // group-pooled path is exercised via walkGroupMemberPractitionerRoleSchedules
    // and additionally filtered to active-Practitioners in fhir.ts.
    const fixture = await createPrFixture();

    const before = await callGetSchedule(fixture.slug, 'provider');
    expect(before.ok).toBe(true);

    await oystehr.fhir.patch<Practitioner>({
      resourceType: 'Practitioner',
      id: fixture.practitioner.id!,
      operations: [{ op: 'add', path: '/active', value: false }],
    });

    const after = await callGetSchedule(fixture.slug, 'provider');
    expect(after.ok).toBe(false);
    if (!after.ok) expectScheduleNotFound(after.error);
  });

  test('pools-providers group with an inactive member Practitioner — group URL still vends, but only from active members', async () => {
    // The same human-deactivation toggle from Employees > Provider details
    // applies to providers participating in a group: their slots must drop
    // out of the group's bookable pool. Unlike the PR-direct case the group
    // itself stays bookable — slots from the *other* active members must
    // still surface — so the assertion is targeted: response succeeds, but
    // no slot's owning Schedule is the inactive member's.
    //
    // Members A and B have disjoint hours (morning vs afternoon). Slot
    // dedup picks the same schedule for tied start times, so without
    // disjoint hours Schedule-B's id would never surface even before
    // deactivation and the negative case would pass for the wrong reason.
    const fixture = await createGroupFixture();
    // `selectedDate` = tomorrow in the schedule's timezone so every working
    // hour (09–12 for A, 13–17 for B) is in the future regardless of when
    // the test runs.
    const selectedDate = startOfDayWithTimezone({
      date: DateTime.now().plus({ days: 1 }),
      timezone: 'America/New_York',
    }).toISODate();
    assert(selectedDate);

    const callGroup = async (): Promise<GetScheduleResponse> => {
      const res = await oystehr.zambda.executePublic({
        id: 'get-schedule',
        slug: fixture.slug,
        scheduleType: 'group',
        selectedDate,
      });
      return res.output as GetScheduleResponse;
    };

    const before = await callGroup();
    const beforeScheduleRefs = new Set(
      (before.available ?? []).map((sli) => sli.slot.schedule?.reference).filter((ref): ref is string => !!ref)
    );
    // Positive control: both members vend at least one slot. Confirms the
    // fixture is wired up correctly before the deactivation.
    expect(beforeScheduleRefs.has(`Schedule/${fixture.scheduleA.id}`)).toBe(true);
    expect(beforeScheduleRefs.has(`Schedule/${fixture.scheduleB.id}`)).toBe(true);

    // Deactivate Practitioner B via the Employees-side toggle equivalent.
    await oystehr.fhir.patch<Practitioner>({
      resourceType: 'Practitioner',
      id: fixture.practitionerB.id!,
      operations: [{ op: 'add', path: '/active', value: false }],
    });

    const after = await callGroup();
    const afterScheduleRefs = new Set(
      (after.available ?? []).map((sli) => sli.slot.schedule?.reference).filter((ref): ref is string => !!ref)
    );
    expect(afterScheduleRefs.has(`Schedule/${fixture.scheduleA.id}`)).toBe(true);
    expect(afterScheduleRefs.has(`Schedule/${fixture.scheduleB.id}`)).toBe(false);
  });

  test('pools-providers group with an inactive member PractitionerRole — group URL still vends, but only from active members', async () => {
    // PR-level deactivation (Schedules > General "Active" toggle for that
    // specific location-scoped role) is independent of the Practitioner-
    // level deactivation. A provider may be active globally (Employees >
    // Provider details ON) while one of their location-scoped PRs is
    // turned off, in which case only that PR's schedule should drop out
    // of any group it participates in.
    //
    // PRs `_revinclude`d into the bundle aren't filtered by the FHIR
    // search-level active filter (that filter targets the *primary*
    // resource type — HealthcareService for groups), so the inactive PR
    // would reach `walkGroupMemberPractitionerRoleSchedules` unchecked
    // without the in-code bundle filter.
    const fixture = await createGroupFixture();
    const selectedDate = startOfDayWithTimezone({
      date: DateTime.now().plus({ days: 1 }),
      timezone: 'America/New_York',
    }).toISODate();
    assert(selectedDate);

    const callGroup = async (): Promise<GetScheduleResponse> => {
      const res = await oystehr.zambda.executePublic({
        id: 'get-schedule',
        slug: fixture.slug,
        scheduleType: 'group',
        selectedDate,
      });
      return res.output as GetScheduleResponse;
    };

    const before = await callGroup();
    const beforeScheduleRefs = new Set(
      (before.available ?? []).map((sli) => sli.slot.schedule?.reference).filter((ref): ref is string => !!ref)
    );
    expect(beforeScheduleRefs.has(`Schedule/${fixture.scheduleA.id}`)).toBe(true);
    expect(beforeScheduleRefs.has(`Schedule/${fixture.scheduleB.id}`)).toBe(true);

    // Deactivate the PR (not the Practitioner) for member B.
    await oystehr.fhir.patch<PractitionerRole>({
      resourceType: 'PractitionerRole',
      id: fixture.prB.id!,
      operations: [{ op: 'replace', path: '/active', value: false }],
    });

    const after = await callGroup();
    const afterScheduleRefs = new Set(
      (after.available ?? []).map((sli) => sli.slot.schedule?.reference).filter((ref): ref is string => !!ref)
    );
    expect(afterScheduleRefs.has(`Schedule/${fixture.scheduleA.id}`)).toBe(true);
    expect(afterScheduleRefs.has(`Schedule/${fixture.scheduleB.id}`)).toBe(false);
  });
});
