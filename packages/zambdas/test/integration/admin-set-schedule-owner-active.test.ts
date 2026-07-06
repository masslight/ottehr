import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { INTEGRATION_TEST_TAG_SYSTEM, M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Pin the behavior we care about at the zambda boundary rather than at the
// FHIR PATCH boundary — that's the whole reason this endpoint exists. The
// tests intentionally construct their Schedules and owners as bare FHIR
// resources so we're not implicitly coupled to any of the create/update
// zambdas' side effects; each case wires exactly the shape it needs.

describe('admin-set-schedule-owner-active', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  type TrackedResource = 'Location' | 'Practitioner' | 'PractitionerRole' | 'HealthcareService' | 'Schedule';
  const createdIds: Array<{ resourceType: TrackedResource; id: string }> = [];

  const track = <T extends { resourceType: string; id?: string }>(r: T): T => {
    if (r.id) createdIds.push({ resourceType: r.resourceType as TrackedResource, id: r.id });
    return r;
  };
  const tag = (): { meta: { tag: Array<{ system: string; code: string }> } } => ({
    meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
  });

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-set-schedule-owner-active.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;
  }, 60_000);

  afterAll(async () => {
    // Delete in reverse dependency order — Schedules first (they reference
    // actors) so their owners are still present in FHIR and the delete
    // doesn't cascade-fail.
    for (const r of [...createdIds].reverse()) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: r.resourceType, id: r.id });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  const makeLocation = async (opts: { status: 'active' | 'inactive' } = { status: 'active' }): Promise<Location> => {
    return track(
      await oystehrAdmin.fhir.create<Location>({
        resourceType: 'Location',
        status: opts.status,
        name: `SSO-A Loc ${randomUUID().slice(0, 8)}`,
        ...tag(),
      })
    );
  };

  const makePractitioner = async (opts: { active: boolean } = { active: true }): Promise<Practitioner> => {
    return track(
      await oystehrAdmin.fhir.create<Practitioner>({
        resourceType: 'Practitioner',
        active: opts.active,
        name: [{ given: ['SSO'], family: `A-${randomUUID().slice(0, 8)}` }],
        ...tag(),
      })
    );
  };

  const makeSchedule = async (actor: { resourceType: string; id: string }): Promise<Schedule> => {
    return track(
      await oystehrAdmin.fhir.create<Schedule>({
        resourceType: 'Schedule',
        actor: [{ reference: `${actor.resourceType}/${actor.id}` }],
        ...tag(),
      })
    );
  };

  const invoke = async (input: unknown): Promise<any> =>
    oystehrZambdas.zambda.execute({ id: 'admin-set-schedule-owner-active', ...(input as object) });

  // Catch-and-return-message pattern shared with the other admin-* tests.
  // The OystehrSdkError isn't a proper Error subclass, so
  // `.rejects.toThrow(regex)` can toString to '[object Object]' even when
  // the underlying `.message` field carries the prose we want to match.
  // Extract it directly the same way admin-service-categories.test.ts does.
  const invokeExpectingRejection = async (input: unknown): Promise<{ message: string }> => {
    let caught: unknown;
    try {
      await oystehrZambdas.zambda.execute({ id: 'admin-set-schedule-owner-active', ...(input as object) });
    } catch (e) {
      caught = e;
    }
    if (!caught) throw new Error('expected admin-set-schedule-owner-active to reject the payload but it succeeded');
    const err = caught as { message?: string };
    return { message: err.message ?? '' };
  };

  it('flips a Location-owned schedule to inactive by writing status=inactive on the Location', async () => {
    const location = await makeLocation({ status: 'active' });
    const schedule = await makeSchedule({ resourceType: 'Location', id: location.id! });

    const response = await invoke({ scheduleId: schedule.id, active: false });
    const body = response.output as { active: boolean; owner: { resourceType: string; id: string } };
    // The derived boolean comes back true when Location.status === 'active';
    // this asserts BOTH the response contract AND the underlying patch.
    expect(body.active).toBe(false);
    expect(body.owner).toEqual({ resourceType: 'Location', id: location.id });

    const fetched = await oystehrAdmin.fhir.get<Location>({ resourceType: 'Location', id: location.id! });
    expect(fetched.status).toBe('inactive');
  });

  it('flips a Location-owned schedule back to active by writing status=active', async () => {
    const location = await makeLocation({ status: 'inactive' });
    const schedule = await makeSchedule({ resourceType: 'Location', id: location.id! });

    const response = await invoke({ scheduleId: schedule.id, active: true });
    expect(response.output.active).toBe(true);

    const fetched = await oystehrAdmin.fhir.get<Location>({ resourceType: 'Location', id: location.id! });
    expect(fetched.status).toBe('active');
  });

  it('flips a Practitioner-owned schedule to inactive by writing active=false on the Practitioner', async () => {
    const practitioner = await makePractitioner({ active: true });
    const schedule = await makeSchedule({ resourceType: 'Practitioner', id: practitioner.id! });

    const response = await invoke({ scheduleId: schedule.id, active: false });
    expect(response.output.active).toBe(false);
    expect(response.output.owner).toEqual({ resourceType: 'Practitioner', id: practitioner.id });

    const fetched = await oystehrAdmin.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: practitioner.id!,
    });
    // FHIR omits `active: true` on some servers; false must round-trip explicitly.
    expect(fetched.active).toBe(false);
  });

  it('flips a Practitioner-owned schedule back to active and returns active=true even if FHIR omits the field from the response', async () => {
    // Regression pin for the "some FHIR servers strip active: true from
    // responses" case. The zambda used to re-derive the response bool from
    // the patched resource — on those servers this would return false even
    // though the patch had just set active=true. Fix returns the requested
    // value, which is authoritative because the patch either applied or
    // threw. Whichever way the underlying FHIR server behaves on the
    // response body, our contract stays honest.
    const practitioner = await makePractitioner({ active: false });
    const schedule = await makeSchedule({ resourceType: 'Practitioner', id: practitioner.id! });

    const response = await invoke({ scheduleId: schedule.id, active: true });
    expect(response.output.active).toBe(true);
    expect(response.output.owner).toEqual({ resourceType: 'Practitioner', id: practitioner.id });

    // Post-conditions on FHIR itself: `.active` must be true (or missing —
    // FHIR's default is true, so omission reads as true) so a subsequent
    // GET behaves the same as if the field were explicitly set. Assert on
    // both shapes so the test doesn't get brittle across server variants.
    const fetched = await oystehrAdmin.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: practitioner.id!,
    });
    expect(fetched.active === true || fetched.active === undefined).toBe(true);
  });

  it('rejects a PractitionerRole-owned schedule with a clear "use the other endpoint" message', async () => {
    // Set up a PR + Schedule directly; we don't want the actual
    // admin-create-practitioner-role side effects — this test is about the
    // owner-type guard.
    const location = await makeLocation();
    const practitioner = await makePractitioner();
    const pr = track(
      await oystehrAdmin.fhir.create<PractitionerRole>({
        resourceType: 'PractitionerRole',
        active: true,
        practitioner: { reference: `Practitioner/${practitioner.id}` },
        location: [{ reference: `Location/${location.id}` }],
        ...tag(),
      })
    );
    const schedule = await makeSchedule({ resourceType: 'PractitionerRole', id: pr.id! });

    // PR owners must go through admin-set-practitioner-role-active — this
    // endpoint's simpler patch model would silently skip the conflict
    // re-check that PR reactivation depends on.
    const { message } = await invokeExpectingRejection({ scheduleId: schedule.id, active: false });
    expect(message).toMatch(/admin-set-practitioner-role-active/);
  });

  it('rejects a HealthcareService-owned schedule (Groups do not own their own Schedules in this data model)', async () => {
    const group = track(
      await oystehrAdmin.fhir.create<HealthcareService>({
        resourceType: 'HealthcareService',
        active: true,
        name: `SSO-A Group ${randomUUID().slice(0, 8)}`,
        ...tag(),
      })
    );
    const schedule = await makeSchedule({ resourceType: 'HealthcareService', id: group.id! });

    const { message } = await invokeExpectingRejection({ scheduleId: schedule.id, active: false });
    expect(message).toMatch(/HealthcareService-owned Schedules are not supported/);
  });

  it('validation: missing scheduleId', async () => {
    // Shape-of-the-contract test — we care that the zambda rejects, not
    // what the exact prose is (zod's default missing-field message is
    // sufficient).
    await invokeExpectingRejection({ active: true });
  });

  it('validation: active is not a boolean', async () => {
    const location = await makeLocation();
    const schedule = await makeSchedule({ resourceType: 'Location', id: location.id! });
    await invokeExpectingRejection({ scheduleId: schedule.id, active: 'yes' });
  });
});
