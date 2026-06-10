import Oystehr, { BatchInputDeleteRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  Coding,
  FhirResource,
  HealthcareService,
  Location,
  Practitioner,
  PractitionerRole,
  Schedule,
  Slot,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CreateAppointmentInputParams,
  CreateAppointmentResponse,
  GROUP_ASSIGNMENT_MODE_SYSTEM,
  PatientInfo,
  SCHEDULE_EXTENSION_URL,
  ScheduleStrategyCoding,
  SLOT_BOOKED_VIA_GROUP_EXTENSION_URL,
  SLOT_FALLBACK_REROUTED_TAG_SYSTEM,
  SLOT_UNAVAILABLE_ERROR,
  SlotServiceCategory,
} from 'utils';
import { afterAll, assert, beforeAll, describe, expect, inject, test } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import {
  buildSimpleScheduleExt,
  cleanupTestScheduleResources,
  makeTestPatient,
  startOfDayWithTimezone,
  tagForProcessId,
} from '../helpers/testScheduleUtils';

// Integration coverage for the D-6 fallback path. Asserts the gates we
// agreed on: (a) non-group bookings don't reroute, (b) provider-mode group
// bookings don't reroute (the patient picked a specific provider — silent
// swizzle would break that contract), (c) anonymous-mode bookings reroute
// to another member at the SAME Location when the originally-targeted
// member is saturated, (d) the Location filter is hard — a cross-Location
// candidate with capacity does NOT rescue the booking.
describe('create-appointment group-member fallback (D-6 phase 2)', () => {
  let oystehr: Oystehr;
  let token: string | null = null;
  let processId: string | null = null;
  let tag: Coding;

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
    tag = {
      system: 'OTTEHR_AUTOMATED_TEST',
      code: tagForProcessId(processId),
      display: 'fallback integration fixture',
    };
  });

  afterAll(async () => {
    if (!oystehr || !processId) return;
    // Sweep tagged Schedules + their Schedule:actor PRs + revincluded Slots.
    // HSs, Locations, Practitioners are deleted explicitly per-test (the
    // sweep helper's _include doesn't iterate through PR→Location or
    // PR→Practitioner). The cron is the safety net for anything missed.
    await cleanupTestScheduleResources(processId, oystehr);
  });

  // Build a fresh fixture: 2 Locations (Loc-A, Loc-B), 3 Practitioners,
  // 3 PRs (PR-1+PR-2@Loc-A, PR-3@Loc-B), 3 Schedules (one per PR, capacity
  // 1/hour for the open hours). Group HS pools-providers in the requested
  // assignment mode; PRs are members via both back-reference (.service) and
  // location-overlap, so getSchedules' membership walk picks them up either
  // way. Returns the persisted resources + an explicit delete list for the
  // resource types cleanupTestScheduleResources doesn't sweep.
  interface BuildGroupFixtureOutput {
    groupHs: HealthcareService;
    locationA: Location;
    locationB: Location;
    schedule1: Schedule;
    schedule2: Schedule;
    schedule3: Schedule;
    explicitCleanup: BatchInputDeleteRequest[];
  }
  const buildGroupFixture = async (input: {
    assignmentMode: 'anonymous' | 'provider';
  }): Promise<BuildGroupFixtureOutput> => {
    const { assignmentMode } = input;
    // One provider on shift every hour of every day. A single busy slot at
    // a given hour saturates the bucket for a 60-min booking.
    const scheduleJson = buildSimpleScheduleExt();

    const locAUrn = `urn:uuid:${randomUUID()}`;
    const locBUrn = `urn:uuid:${randomUUID()}`;
    const prac1Urn = `urn:uuid:${randomUUID()}`;
    const prac2Urn = `urn:uuid:${randomUUID()}`;
    const prac3Urn = `urn:uuid:${randomUUID()}`;
    const pr1Urn = `urn:uuid:${randomUUID()}`;
    const pr2Urn = `urn:uuid:${randomUUID()}`;
    const pr3Urn = `urn:uuid:${randomUUID()}`;
    const hsUrn = `urn:uuid:${randomUUID()}`;

    const makeLocation = (name: string, urn: string): BatchInputPostRequest<FhirResource> => ({
      method: 'POST',
      url: 'Location',
      fullUrl: urn,
      resource: {
        resourceType: 'Location',
        status: 'active',
        name,
        meta: { tag: [tag] },
      },
    });
    const makePractitioner = (name: string, urn: string): BatchInputPostRequest<FhirResource> => ({
      method: 'POST',
      url: 'Practitioner',
      fullUrl: urn,
      resource: {
        resourceType: 'Practitioner',
        name: [{ family: name, given: ['Test'] }],
        meta: { tag: [tag] },
      },
    });
    const makePR = (
      urn: string,
      practitionerUrn: string,
      locationUrn: string
    ): BatchInputPostRequest<FhirResource> => ({
      method: 'POST',
      url: 'PractitionerRole',
      fullUrl: urn,
      resource: {
        resourceType: 'PractitionerRole',
        active: true,
        practitioner: { reference: practitionerUrn },
        location: [{ reference: locationUrn }],
        healthcareService: [{ reference: hsUrn }],
        meta: { tag: [tag] },
      },
    });
    const makeSchedule = (prUrn: string): BatchInputPostRequest<FhirResource> => ({
      method: 'POST',
      url: 'Schedule',
      resource: {
        resourceType: 'Schedule',
        actor: [{ reference: prUrn }],
        extension: [
          { url: 'http://hl7.org/fhir/StructureDefinition/timezone', valueString: 'America/New_York' },
          { url: SCHEDULE_EXTENSION_URL, valueString: JSON.stringify(scheduleJson) },
        ],
        meta: { tag: [tag] },
      },
    });

    const requests: BatchInputPostRequest<FhirResource>[] = [
      makeLocation('Fallback-Loc-A', locAUrn),
      makeLocation('Fallback-Loc-B', locBUrn),
      makePractitioner('Prac1', prac1Urn),
      makePractitioner('Prac2', prac2Urn),
      makePractitioner('Prac3', prac3Urn),
      makePR(pr1Urn, prac1Urn, locAUrn),
      makePR(pr2Urn, prac2Urn, locAUrn),
      makePR(pr3Urn, prac3Urn, locBUrn),
      makeSchedule(pr1Urn),
      makeSchedule(pr2Urn),
      makeSchedule(pr3Urn),
      {
        method: 'POST',
        url: 'HealthcareService',
        fullUrl: hsUrn,
        resource: {
          resourceType: 'HealthcareService',
          active: true,
          name: 'Fallback Test Group',
          location: [{ reference: locAUrn }, { reference: locBUrn }],
          characteristic: [
            {
              coding: [
                {
                  system: ScheduleStrategyCoding.poolsProviders.system,
                  code: ScheduleStrategyCoding.poolsProviders.code,
                },
              ],
            },
            { coding: [{ system: GROUP_ASSIGNMENT_MODE_SYSTEM, code: assignmentMode }] },
          ],
          meta: { tag: [tag] },
        },
      },
    ];

    const tx = await oystehr.fhir.transaction({ requests });
    const find = <T extends FhirResource>(rt: string, predicate?: (r: T) => boolean): T => {
      const entries = (tx.entry ?? [])
        .map((e) => e.resource as T | undefined)
        .filter((r): r is T => !!r && r.resourceType === rt);
      const found = predicate ? entries.find(predicate) : entries[0];
      assert(found, `${rt} not found in transaction result`);
      return found;
    };

    const locations = (tx.entry ?? [])
      .map((e) => e.resource as Location | undefined)
      .filter((r): r is Location => !!r && r.resourceType === 'Location');
    const locationA = locations.find((l) => l.name === 'Fallback-Loc-A')!;
    const locationB = locations.find((l) => l.name === 'Fallback-Loc-B')!;
    assert(locationA?.id);
    assert(locationB?.id);

    // Transaction-result PRs aren't pre-ordered; pick the two at Loc-A and
    // the one at Loc-B.
    const allPRs = (tx.entry ?? [])
      .map((e) => e.resource as PractitionerRole | undefined)
      .filter((r): r is PractitionerRole => !!r && r.resourceType === 'PractitionerRole');
    const prsAtA = allPRs.filter((pr) => pr.location?.[0]?.reference === `Location/${locationA.id}`);
    const prsAtB = allPRs.filter((pr) => pr.location?.[0]?.reference === `Location/${locationB.id}`);
    expect(prsAtA.length).toBe(2);
    expect(prsAtB.length).toBe(1);
    const [prA1, prA2] = prsAtA;
    const [prB1] = prsAtB;

    const allSchedules = (tx.entry ?? [])
      .map((e) => e.resource as Schedule | undefined)
      .filter((r): r is Schedule => !!r && r.resourceType === 'Schedule');
    const scheduleByPRId = (prId: string): Schedule => {
      const s = allSchedules.find((sch) => sch.actor?.[0]?.reference === `PractitionerRole/${prId}`);
      assert(s, `Schedule for PR/${prId} not found`);
      return s;
    };
    const schedule1 = scheduleByPRId(prA1.id!);
    const schedule2 = scheduleByPRId(prA2.id!);
    const schedule3 = scheduleByPRId(prB1.id!);

    const groupHs = find<HealthcareService>('HealthcareService');
    const allPractitioners = (tx.entry ?? [])
      .map((e) => e.resource as Practitioner | undefined)
      .filter((r): r is Practitioner => !!r && r.resourceType === 'Practitioner');

    // Resource types not covered by cleanupTestScheduleResources' sweep:
    // HS (not pulled into the Schedule-rooted query), Locations and
    // Practitioners (reachable only via PR.location / PR.practitioner,
    // which the _include doesn't iterate). PRs and Schedules ARE swept.
    const explicitCleanup: BatchInputDeleteRequest[] = [
      { method: 'DELETE', url: `HealthcareService/${groupHs.id}` },
      { method: 'DELETE', url: `Location/${locationA.id}` },
      { method: 'DELETE', url: `Location/${locationB.id}` },
      ...allPractitioners.map((p) => ({ method: 'DELETE' as const, url: `Practitioner/${p.id}` })),
    ];

    return { groupHs, locationA, locationB, schedule1, schedule2, schedule3, explicitCleanup };
  };

  // Anchor slot times to TOMORROW so the slot's end is always in the
  // future at test run time. Today-based times would trigger the
  // create-appointment past-slot guard bypass (slot.end <= now skips the
  // capacity check), invalidating the rejection assertions in tests
  // (a)/(b)/(d). Tomorrow + any hour 0-23 is always future.
  const slotDayBase = (): ReturnType<typeof startOfDayWithTimezone> =>
    startOfDayWithTimezone({ date: DateTime.now().plus({ days: 1 }) });

  // Direct-FHIR slot, status=busy-tentative (create-appointment promotes to
  // busy). Includes the booked-via-group extension when groupHsId is given.
  const createPatientSlot = async (input: {
    schedule: Schedule;
    bookedViaGroupId?: string;
    hourOfDay: number;
  }): Promise<Slot> => {
    const { schedule, bookedViaGroupId, hourOfDay } = input;
    const start = slotDayBase().plus({ hours: hourOfDay });
    const end = start.plus({ hours: 1 });
    const extension: Slot['extension'] = [];
    if (bookedViaGroupId) {
      extension.push({
        url: SLOT_BOOKED_VIA_GROUP_EXTENSION_URL,
        valueReference: { reference: `HealthcareService/${bookedViaGroupId}` },
      });
    }
    return await oystehr.fhir.create<Slot>({
      resourceType: 'Slot',
      status: 'busy-tentative',
      start: start.toISO()!,
      end: end.toISO()!,
      schedule: { reference: `Schedule/${schedule.id}` },
      serviceCategory: [SlotServiceCategory.inPersonServiceMode],
      extension,
      meta: { tag: [tag] },
    });
  };

  // Saturation slot — counts against the Schedule's bucket for the same hour.
  const createBusySlot = async (input: { schedule: Schedule; hourOfDay: number }): Promise<Slot> => {
    const { schedule, hourOfDay } = input;
    const start = slotDayBase().plus({ hours: hourOfDay });
    const end = start.plus({ hours: 1 });
    return await oystehr.fhir.create<Slot>({
      resourceType: 'Slot',
      status: 'busy',
      start: start.toISO()!,
      end: end.toISO()!,
      schedule: { reference: `Schedule/${schedule.id}` },
      meta: { tag: [tag] },
    });
  };

  const cleanupFixture = async (
    explicitCleanup: BatchInputDeleteRequest[],
    extraSlotIds: string[] = []
  ): Promise<void> => {
    const requests: BatchInputDeleteRequest[] = [
      ...extraSlotIds.map((id) => ({ method: 'DELETE' as const, url: `Slot/${id}` })),
      ...explicitCleanup,
    ];
    try {
      await oystehr.fhir.batch({ requests });
    } catch (e) {
      console.warn('Per-test cleanup encountered errors; cron sweep will retry:', e);
    }
  };

  const renderError = (e: unknown): string => {
    const err = e as {
      message?: string;
      body?: unknown;
      statusCode?: number;
      status?: number;
      name?: string;
      code?: number;
    };
    const status = err?.statusCode ?? err?.status ?? '?';
    const name = err?.name ?? 'Error';
    const msg = err?.message ?? String(e);
    const code = err?.code ?? '?';
    let body = '';
    try {
      body = err?.body !== undefined ? JSON.stringify(err.body) : JSON.stringify(e);
    } catch {
      body = String(e);
    }
    return `${name} status=${status} code=${code} message="${msg}" body=${body}`;
  };

  // The capacity guard's specific rejection code. Asserting this catches
  // false positives where create-appointment threw for some unrelated reason
  // (schedule misconfiguration, slot not found, service mode resolution
  // failure, etc.) and the test happily accepted it as "ok=false". Imported
  // from utils so the assertion follows the canonical APIErrorCode rather
  // than a hand-typed number — the previous local `= 4340` happened to be
  // INVALID_INPUT's code, not SLOT_UNAVAILABLE's, and matched only because
  // the validator used to throw INVALID_INPUT_ERROR here.
  const expectCapacityRejection = (result: { ok: boolean; error?: unknown }): void => {
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.error as { code?: number };
    expect(err?.code).toBe(SLOT_UNAVAILABLE_ERROR.code);
  };

  const callCreateAppointment = async (
    slotId: string
  ): Promise<{ ok: true; output: unknown } | { ok: false; error: unknown; message: string }> => {
    const patient = makeTestPatient();
    const patientInfo: PatientInfo = {
      firstName: patient.name![0]!.given![0],
      lastName: patient.name![0]!.family,
      sex: 'female',
      dateOfBirth: patient.birthDate,
      newPatient: true,
      phoneNumber: '+12027139680',
      email: `fallback-${randomUUID()}@example.com`,
      tags: [tag],
    };
    const params: CreateAppointmentInputParams = { patient: patientInfo, slotId };
    try {
      const res = await oystehr.zambda.execute({ id: 'create-appointment', ...params });
      return { ok: true, output: res.output };
    } catch (e) {
      return { ok: false, error: e, message: renderError(e) };
    }
  };

  test('(a) non-group booking — saturated Schedule errors, no fallback attempted', async () => {
    const fixture = await buildGroupFixture({ assignmentMode: 'anonymous' });
    const hour = 14;
    const patientSlot = await createPatientSlot({ schedule: fixture.schedule1, hourOfDay: hour });
    const busy = await createBusySlot({ schedule: fixture.schedule1, hourOfDay: hour });
    try {
      const result = await callCreateAppointment(patientSlot.id!);
      // Specific capacity-guard rejection (not any other validation that happens
      // to also throw — see expectCapacityRejection comment).
      expectCapacityRejection(result);
      // Even though the group exists with an idle Loc-A peer (Schedule-2),
      // the slot wasn't booked through the group → no fallback path runs.
      // Verify the slot wasn't rerouted either.
      const fetched = await oystehr.fhir.get<Slot>({ resourceType: 'Slot', id: patientSlot.id! });
      expect(fetched.schedule.reference).toBe(`Schedule/${fixture.schedule1.id}`);
      const tags = fetched.meta?.tag ?? [];
      expect(tags.some((t) => t.system === SLOT_FALLBACK_REROUTED_TAG_SYSTEM)).toBe(false);

      // Positive control: removing the saturating busy slot should let the
      // SAME patient slot book successfully. Proves the rejection above was
      // caused by the saturation and not by some unrelated fixture issue
      // (e.g., 0-effective-capacity schedule, malformed slot, etc.).
      await oystehr.fhir.delete({ resourceType: 'Slot', id: busy.id! });
      const recovery = await callCreateAppointment(patientSlot.id!);
      if (!recovery.ok) {
        throw new Error(`positive control failed (fixture not bookable absent saturation): ${recovery.message}`);
      }
    } finally {
      await cleanupFixture(fixture.explicitCleanup, [patientSlot.id!, busy.id!]);
    }
  });

  test('(b) provider-mode group booking — saturated, no fallback (patient picked the provider)', async () => {
    const fixture = await buildGroupFixture({ assignmentMode: 'provider' });
    const hour = 15;
    const patientSlot = await createPatientSlot({
      schedule: fixture.schedule1,
      bookedViaGroupId: fixture.groupHs.id!,
      hourOfDay: hour,
    });
    const busy = await createBusySlot({ schedule: fixture.schedule1, hourOfDay: hour });
    try {
      const result = await callCreateAppointment(patientSlot.id!);
      expectCapacityRejection(result);
      const fetched = await oystehr.fhir.get<Slot>({ resourceType: 'Slot', id: patientSlot.id! });
      expect(fetched.schedule.reference).toBe(`Schedule/${fixture.schedule1.id}`);
      const tags = fetched.meta?.tag ?? [];
      expect(tags.some((t) => t.system === SLOT_FALLBACK_REROUTED_TAG_SYSTEM)).toBe(false);

      // Positive control: with the saturation removed, the SAME booking
      // should succeed on Schedule-1 directly (provider mode → no fallback
      // path; only the capacity guard was rejecting). Proves the rejection
      // was the capacity guard's, not a different validation.
      await oystehr.fhir.delete({ resourceType: 'Slot', id: busy.id! });
      const recovery = await callCreateAppointment(patientSlot.id!);
      if (!recovery.ok) {
        throw new Error(`positive control failed (fixture not bookable absent saturation): ${recovery.message}`);
      }
      const fetchedAfterRecovery = await oystehr.fhir.get<Slot>({ resourceType: 'Slot', id: patientSlot.id! });
      // Provider mode → no swap should have happened on recovery either.
      expect(fetchedAfterRecovery.schedule.reference).toBe(`Schedule/${fixture.schedule1.id}`);
    } finally {
      await cleanupFixture(fixture.explicitCleanup, [patientSlot.id!, busy.id!]);
    }
  });

  test('(c) anonymous-mode group booking — reroutes to same-Location peer when original saturated', async () => {
    const fixture = await buildGroupFixture({ assignmentMode: 'anonymous' });
    const hour = 16;
    const patientSlot = await createPatientSlot({
      schedule: fixture.schedule1,
      bookedViaGroupId: fixture.groupHs.id!,
      hourOfDay: hour,
    });
    const busy = await createBusySlot({ schedule: fixture.schedule1, hourOfDay: hour });
    try {
      const result = await callCreateAppointment(patientSlot.id!);
      if (!result.ok) {
        // Re-throw with the rendered server error so the failure points at
        // the actual cause rather than just "ok was false".
        throw new Error(`create-appointment rejected the fallback path: ${result.message}`);
      }
      // The slot's schedule.reference should have been swapped to the
      // Loc-A peer (Schedule-2). Don't assert it points specifically at
      // Schedule-2 vs another Loc-A peer if more were ever added — but
      // here Schedule-2 is the only available Loc-A peer, so it must be
      // that one.
      const fetched = await oystehr.fhir.get<Slot>({ resourceType: 'Slot', id: patientSlot.id! });
      expect(fetched.schedule.reference).toBe(`Schedule/${fixture.schedule2.id}`);
      const tags = fetched.meta?.tag ?? [];
      expect(tags.some((t) => t.system === SLOT_FALLBACK_REROUTED_TAG_SYSTEM)).toBe(true);

      // The group HS should be stamped on Appointment.participant so
      // consumers can query "appointments booked via group X" directly
      // (rather than walking each Slot's bookedViaGroup extension).
      const response = result.output as CreateAppointmentResponse;
      const participantRefs = (response.resources.appointment.participant ?? [])
        .map((p) => p.actor?.reference)
        .filter((r): r is string => !!r);
      expect(participantRefs).toContain(`HealthcareService/${fixture.groupHs.id}`);
    } finally {
      await cleanupFixture(fixture.explicitCleanup, [patientSlot.id!, busy.id!]);
    }
  });

  test('(d) anonymous + all same-Location members saturated — does NOT reroute across Locations', async () => {
    const fixture = await buildGroupFixture({ assignmentMode: 'anonymous' });
    const hour = 17;
    const patientSlot = await createPatientSlot({
      schedule: fixture.schedule1,
      bookedViaGroupId: fixture.groupHs.id!,
      hourOfDay: hour,
    });
    const busy1 = await createBusySlot({ schedule: fixture.schedule1, hourOfDay: hour });
    const busy2 = await createBusySlot({ schedule: fixture.schedule2, hourOfDay: hour });
    // Schedule-3 (Loc-B) is wide open — must NOT be picked by the
    // fallback, since the originating Location is Loc-A.
    try {
      const result = await callCreateAppointment(patientSlot.id!);
      expectCapacityRejection(result);
      const fetched = await oystehr.fhir.get<Slot>({ resourceType: 'Slot', id: patientSlot.id! });
      expect(fetched.schedule.reference).toBe(`Schedule/${fixture.schedule1.id}`);
      const tags = fetched.meta?.tag ?? [];
      expect(tags.some((t) => t.system === SLOT_FALLBACK_REROUTED_TAG_SYSTEM)).toBe(false);

      // Positive control: free up Schedule-2 (still leaving Schedule-1
      // saturated). The fallback should now find Schedule-2 — proving (1)
      // Schedule-3 wasn't being rejected just because all candidates were
      // unbookable, and (2) the swap-to-Loc-A logic still works. If the
      // Location filter were broken, the recovery booking could land on
      // Schedule-3 (Loc-B) instead — the explicit Schedule-2 assertion
      // below catches that.
      await oystehr.fhir.delete({ resourceType: 'Slot', id: busy2.id! });
      const recovery = await callCreateAppointment(patientSlot.id!);
      if (!recovery.ok) {
        throw new Error(
          `positive control failed (fixture not bookable absent Schedule-2 saturation): ${recovery.message}`
        );
      }
      const fetchedAfterRecovery = await oystehr.fhir.get<Slot>({ resourceType: 'Slot', id: patientSlot.id! });
      expect(fetchedAfterRecovery.schedule.reference).toBe(`Schedule/${fixture.schedule2.id}`);
    } finally {
      await cleanupFixture(fixture.explicitCleanup, [patientSlot.id!, busy1.id!, busy2.id!]);
    }
  });
});
