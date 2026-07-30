import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Appointment, Location, PractitionerRole, Schedule } from 'fhir/r4b';
import { APIErrorCode, M2MClientMockType, RoleType, SLUG_SYSTEM } from 'utils';
import { assert } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { tagForProcessId } from '../helpers/testScheduleUtils';

// delete-location is the guarded hard-delete: Admin/CustomerSupport only, two-phase
// (force=false warns on dependents, force=true cascades Schedules/PRs and deletes the
// Location). The appointment case is deliberately written to accept EITHER outcome and
// log which — it's the empirical check for whether Oystehr enforces referential
// integrity on delete (i.e. whether "appointments are force-overridable" is achievable
// or whether they're an absolute floor).

const TAG_SYSTEM = 'OTTEHR_AUTOMATED_TEST';

describe('delete-location zambda — guarded hard-delete', () => {
  let oystehrAdmin: Oystehr;
  let oystehrTestUserM2M: Oystehr;
  let processId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/delete-location.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrTestUserM2M = setup.oystehrTestUserM2M;
    processId = setup.processId;

    // The test M2M is provisioned with Provider only; grant Administrator so it clears
    // the delete-location role gate. Idempotent across reruns.
    const m2mList = (await oystehrAdmin.m2m.listV2({ name: 'integration/delete-location.test.ts' })).data;
    if (m2mList.length > 0) {
      const testM2M = await oystehrAdmin.m2m.get({ id: m2mList[0].id });
      const existingRoleIds = (testM2M.roles ?? []).map((role) => role.id);
      const adminRole = (await oystehrAdmin.role.list()).find((role) => role.name === RoleType.Administrator);
      if (adminRole && !existingRoleIds.includes(adminRole.id)) {
        await oystehrAdmin.m2m.update({ id: testM2M.id, roles: [...existingRoleIds, adminRole.id] });
      }
    }
  }, 120_000);

  afterAll(async () => {
    if (!oystehrAdmin || !processId) return;
    const tag = tagForProcessId(processId);
    for (const resourceType of ['Appointment', 'Schedule', 'PractitionerRole', 'Location'] as const) {
      try {
        const found = (
          await oystehrAdmin.fhir.search({ resourceType, params: [{ name: '_tag', value: tag }] })
        ).unbundle() as { id?: string }[];
        const requests = found
          .filter((r) => r.id)
          .map((r) => ({ method: 'DELETE' as const, url: `${resourceType}/${r.id}` }));
        if (requests.length > 0) await oystehrAdmin.fhir.batch({ requests });
      } catch (error) {
        console.error(`Error cleaning up test ${resourceType}s`, error);
        console.log(`ProcessId ${processId} may need manual cleanup`);
      }
    }
  });

  const tagMeta = (): Location['meta'] => ({ tag: [{ system: TAG_SYSTEM, code: tagForProcessId(processId) }] });

  const makeLocation = async (): Promise<Location> => {
    const created = await oystehrAdmin.fhir.create<Location>({
      resourceType: 'Location',
      status: 'active',
      name: `Delete Location Test ${randomUUID()}`,
      identifier: [{ system: SLUG_SYSTEM, value: `del-loc-${randomUUID()}` }],
      meta: tagMeta(),
    });
    assert(created.id);
    return created;
  };

  const addSchedule = async (locationId: string): Promise<Schedule> =>
    oystehrAdmin.fhir.create<Schedule>({
      resourceType: 'Schedule',
      actor: [{ reference: `Location/${locationId}` }],
      meta: tagMeta(),
    });

  const addPractitionerRole = async (locationId: string): Promise<PractitionerRole> =>
    oystehrAdmin.fhir.create<PractitionerRole>({
      resourceType: 'PractitionerRole',
      location: [{ reference: `Location/${locationId}` }],
      meta: tagMeta(),
    });

  const addAppointment = async (locationId: string): Promise<Appointment> =>
    oystehrAdmin.fhir.create<Appointment>({
      resourceType: 'Appointment',
      status: 'booked',
      // A 'booked' Appointment must carry start/end (FHIR constraint app-3). Static
      // timestamps keep the fixture deterministic.
      start: '2020-01-01T10:00:00.000Z',
      end: '2020-01-01T10:15:00.000Z',
      participant: [{ actor: { reference: `Location/${locationId}` }, status: 'accepted' }],
      meta: tagMeta(),
    });

  const callDelete = async (locationId: string, force: boolean): Promise<any> => {
    const response = await oystehrTestUserM2M.zambda.execute({ id: 'delete-location', locationId, force } as any);
    return (response as any).output;
  };

  const callDeleteExpectingError = async (
    locationId: string,
    force: boolean
  ): Promise<{ code?: number; message: string }> => {
    let caught: unknown;
    try {
      await oystehrTestUserM2M.zambda.execute({ id: 'delete-location', locationId, force } as any);
    } catch (e) {
      caught = e;
    }
    if (!caught) throw new Error('expected delete-location to be rejected, but it succeeded');
    const err = caught as { code?: number; message?: string };
    return { code: err.code, message: err.message ?? '' };
  };

  const exists = async (resourceType: 'Location' | 'Schedule' | 'PractitionerRole', id: string): Promise<boolean> => {
    try {
      await oystehrAdmin.fhir.get({ resourceType, id });
      return true;
    } catch {
      return false;
    }
  };

  it('hard-deletes a Location with no dependents (force not required)', async () => {
    const location = await makeLocation();

    const result = await callDelete(location.id!, false);

    expect(result.deleted).toBe(true);
    expect(result.id).toBe(location.id);
    expect(result.cascaded).toEqual({ schedules: 0, practitionerRoles: 0 });
    expect(result.orphanedAppointments).toBe(0);
    expect(await exists('Location', location.id!)).toBe(false);
  });

  it('refuses (RESOURCE_HAS_DEPENDENTS) when a dependent Schedule exists and force is false', async () => {
    const location = await makeLocation();
    await addSchedule(location.id!);

    const err = await callDeleteExpectingError(location.id!, false);

    expect(err.code).toBe(APIErrorCode.RESOURCE_HAS_DEPENDENTS);
    expect(err.message.toLowerCase()).toContain('schedule');
    // The Location is untouched by a refused delete.
    expect(await exists('Location', location.id!)).toBe(true);
  });

  it('force-deletes and cascades the dependent Schedule + PractitionerRole', async () => {
    const location = await makeLocation();
    const schedule = await addSchedule(location.id!);
    const role = await addPractitionerRole(location.id!);

    const result = await callDelete(location.id!, true);

    expect(result.deleted).toBe(true);
    expect(result.cascaded.schedules).toBe(1);
    expect(result.cascaded.practitionerRoles).toBe(1);
    expect(await exists('Location', location.id!)).toBe(false);
    expect(await exists('Schedule', schedule.id!)).toBe(false);
    expect(await exists('PractitionerRole', role.id!)).toBe(false);
  });

  it('counts Appointments toward the force=false warning', async () => {
    const location = await makeLocation();
    await addAppointment(location.id!);

    const err = await callDeleteExpectingError(location.id!, false);

    expect(err.code).toBe(APIErrorCode.RESOURCE_HAS_DEPENDENTS);
    expect(err.message.toLowerCase()).toContain('appointment');
  });

  // EMPIRICAL: does force-delete of a Location referenced by an Appointment succeed
  // (orphaning the appointment) or does Oystehr's referential integrity block it?
  it('force-delete with an Appointment: records whether orphaning is allowed', async () => {
    const location = await makeLocation();
    const appointment = await addAppointment(location.id!);

    let outcome: 'orphan-delete-allowed' | 'blocked-by-referential-integrity';
    try {
      const result = await callDelete(location.id!, true);
      expect(result.deleted).toBe(true);
      expect(await exists('Location', location.id!)).toBe(false);
      // Appointment is intentionally NOT deleted — it's now orphaned.
      await oystehrAdmin.fhir.get({ resourceType: 'Appointment', id: appointment.id! });
      outcome = 'orphan-delete-allowed';
    } catch (e) {
      const err = e as { code?: number; message?: string };
      expect(err.code).toBe(APIErrorCode.RESOURCE_HAS_DEPENDENTS);
      expect((err.message ?? '').toLowerCase()).toContain('appointment');
      expect(await exists('Location', location.id!)).toBe(true);
      outcome = 'blocked-by-referential-integrity';
    }
    console.log(`[delete-location] force-delete-with-appointment outcome: ${outcome}`);
  });
});
