import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { HealthcareService, Location } from 'fhir/r4b';
import {
  getGroupAllLocations,
  getGroupAssignmentMode,
  INTEGRATION_TEST_TAG_SYSTEM,
  isServiceCategoryHealthcareService,
  M2MClientMockType,
  ScheduleStrategyCoding,
  SLUG_SYSTEM,
  slugFromName,
} from 'utils';
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// admin-create-group builds a Provider group (pooling HealthcareService) in the
// canonical shape server-side, so the client never hand-builds the resource.
describe('admin-create-group', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  // The zambda's output isn't tagged, so track ids to delete in afterAll.
  const createdIds: { resourceType: 'HealthcareService' | 'Location'; id: string }[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-create-group.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;
  }, 60_000);

  afterAll(async () => {
    for (const { resourceType, id } of createdIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType, id });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  const createGroup = async (input: {
    name: string;
    allLocations: boolean;
    locationIds?: string[];
  }): Promise<HealthcareService> => {
    const response = await oystehrZambdas.zambda.execute({ id: 'admin-create-group', ...input });
    const group = response.output as HealthcareService;
    if (group?.id) createdIds.push({ resourceType: 'HealthcareService', id: group.id });
    return group;
  };

  it('creates a pool-all group in the canonical shape', async () => {
    const name = `ACG Pool All ${randomUUID().slice(0, 8)}`;
    const group = await createGroup({ name, allLocations: true });

    expect(group.resourceType).toBe('HealthcareService');
    expect(group.name).toBe(name);
    expect(group.active).toBe(true);
    expect(group.identifier?.find((i) => i.system === SLUG_SYSTEM)?.value).toBe(slugFromName(name));
    expect(getGroupAllLocations(group)).toBe(true);
    expect(getGroupAssignmentMode(group)).toBe('anonymous');
    expect(group.location ?? []).toEqual([]);
    const hasStrategy = (group.characteristic ?? []).some(
      (cc) =>
        cc.coding?.some(
          (c) =>
            c.system === ScheduleStrategyCoding.poolsProviders.system &&
            c.code === ScheduleStrategyCoding.poolsProviders.code
        )
    );
    expect(hasStrategy).toBe(true);
    // A Group, not a service-category catalog entry.
    expect(isServiceCategoryHealthcareService(group)).toBe(false);
  });

  it('creates a location-scoped group carrying its location[]', async () => {
    const loc = await oystehrAdmin.fhir.create<Location>({
      resourceType: 'Location',
      status: 'active',
      name: `ACG Loc ${randomUUID().slice(0, 8)}`,
      meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
    });
    assert(loc.id);
    createdIds.push({ resourceType: 'Location', id: loc.id });

    const group = await createGroup({
      name: `ACG Scoped ${randomUUID().slice(0, 8)}`,
      allLocations: false,
      locationIds: [loc.id],
    });

    expect(getGroupAllLocations(group)).toBe(false);
    expect((group.location ?? []).map((r) => r.reference)).toEqual([`Location/${loc.id}`]);
  });

  it('rejects a name that yields no URL-safe permalink', async () => {
    await expect(
      oystehrZambdas.zambda.execute({ id: 'admin-create-group', name: '@#$%', allLocations: true })
    ).rejects.toThrow();
  });
});
