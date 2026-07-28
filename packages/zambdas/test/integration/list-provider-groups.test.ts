import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { HealthcareService, Location, Practitioner, PractitionerRole } from 'fhir/r4b';
import {
  groupCharacteristics,
  INTEGRATION_TEST_TAG_SYSTEM,
  ListProviderGroupsResponse,
  M2MClientMockType,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  serviceCategoryCharacteristics,
  ServiceMode,
  ServiceVisitType,
} from 'utils';
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// list-provider-groups summarizes each Group HealthcareService (booking pool):
// who it pools (all active providers, or the providers at its .location[]) and
// what services can be booked through it (its type[] allow-list). Service-category
// HealthcareServices (SERVICE_CATEGORY_TAG-tagged) are NOT groups and must be
// excluded.
describe('list-provider-groups', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;

  // Everything we create, deleted best-effort in afterAll.
  const created: {
    resourceType: 'HealthcareService' | 'PractitionerRole' | 'Practitioner' | 'Location';
    id: string;
  }[] = [];

  // Resolved after beforeAll creates the fixtures.
  let locAId: string;
  let locBId: string;
  let locAName: string;
  let locBName: string;
  const groupIds: Record<string, string> = {};

  const tag = (): { system: string; code: string } => ({
    system: INTEGRATION_TEST_TAG_SYSTEM,
    code: `DELETE_ME-${processId}`,
  });

  const createLocation = async (name: string): Promise<Location> => {
    const loc = await oystehrAdmin.fhir.create<Location>({
      resourceType: 'Location',
      status: 'active',
      name,
      meta: { tag: [tag()] },
    });
    assert(loc.id);
    created.push({ resourceType: 'Location', id: loc.id });
    return loc;
  };

  const createPractitioner = async (family: string): Promise<Practitioner> => {
    const p = await oystehrAdmin.fhir.create<Practitioner>({
      resourceType: 'Practitioner',
      active: true,
      name: [{ family, given: ['Test'] }],
      meta: { tag: [tag()] },
    });
    assert(p.id);
    created.push({ resourceType: 'Practitioner', id: p.id });
    return p;
  };

  const createRole = async (practitionerId: string, locationIds: string[]): Promise<PractitionerRole> => {
    const role = await oystehrAdmin.fhir.create<PractitionerRole>({
      resourceType: 'PractitionerRole',
      active: true,
      practitioner: { reference: `Practitioner/${practitionerId}` },
      location: locationIds.map((id) => ({ reference: `Location/${id}` })),
      meta: { tag: [tag()] },
    });
    assert(role.id);
    created.push({ resourceType: 'PractitionerRole', id: role.id });
    return role;
  };

  const createGroup = async (input: {
    name: string;
    allLocations: boolean;
    locationIds?: string[];
    services?: { code: string; display: string }[];
    active?: boolean;
  }): Promise<HealthcareService> => {
    const group = await oystehrAdmin.fhir.create<HealthcareService>({
      resourceType: 'HealthcareService',
      active: input.active ?? true,
      name: input.name,
      // No SERVICE_CATEGORY_TAG → this is a Group, not a service-category entry.
      meta: { tag: [tag()] },
      characteristic: groupCharacteristics({ assignmentMode: 'anonymous', allLocations: input.allLocations }),
      ...(input.locationIds && input.locationIds.length > 0
        ? { location: input.locationIds.map((id) => ({ reference: `Location/${id}` })) }
        : {}),
      ...(input.services && input.services.length > 0
        ? {
            type: input.services.map((s) => ({
              coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: s.code, display: s.display }],
            })),
          }
        : {}),
    });
    assert(group.id);
    created.push({ resourceType: 'HealthcareService', id: group.id });
    return group;
  };

  const createServiceCategoryHs = async (name: string): Promise<HealthcareService> => {
    const hs = await oystehrAdmin.fhir.create<HealthcareService>({
      resourceType: 'HealthcareService',
      active: true,
      name,
      meta: { tag: [SERVICE_CATEGORY_TAG, tag()] },
      type: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: `cat-${randomUUID().slice(0, 8)}`, display: name }] }],
      characteristic: serviceCategoryCharacteristics({
        modes: [ServiceMode['in-person']],
        visitTypes: [ServiceVisitType.prebook],
        durationMinutes: 30,
      }),
    });
    assert(hs.id);
    created.push({ resourceType: 'HealthcareService', id: hs.id });
    return hs;
  };

  const callList = async (): Promise<ListProviderGroupsResponse> => {
    const response = await oystehrZambdas.zambda.execute({ id: 'list-provider-groups' });
    return response.output as ListProviderGroupsResponse;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('list-provider-groups.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;

    const suffix = randomUUID().slice(0, 8);
    locAName = `LPG Location A ${suffix}`;
    locBName = `LPG Location B ${suffix}`;
    const [locA, locB] = await Promise.all([createLocation(locAName), createLocation(locBName)]);
    locAId = locA.id!;
    locBId = locB.id!;

    // P1@A, P2@A+B, P3@B → distinct providers: A={P1,P2}=2, B={P2,P3}=2, A∪B=3.
    const [p1, p2, p3] = await Promise.all([
      createPractitioner(`LPG-P1-${suffix}`),
      createPractitioner(`LPG-P2-${suffix}`),
      createPractitioner(`LPG-P3-${suffix}`),
    ]);
    await Promise.all([
      createRole(p1.id!, [locAId]),
      createRole(p2.id!, [locAId, locBId]),
      createRole(p3.id!, [locBId]),
    ]);

    const groups = await Promise.all([
      createGroup({
        name: `LPG Scoped A ${suffix}`,
        allLocations: false,
        locationIds: [locAId],
        services: [
          { code: `svc-a-${suffix}`, display: 'Sick visit' },
          { code: `svc-b-${suffix}`, display: 'Follow-up' },
        ],
      }),
      createGroup({ name: `LPG Scoped AB ${suffix}`, allLocations: false, locationIds: [locAId, locBId] }),
      createGroup({ name: `LPG No Services ${suffix}`, allLocations: false, locationIds: [locAId] }),
      createGroup({ name: `LPG Inactive ${suffix}`, allLocations: false, locationIds: [locAId], active: false }),
      createGroup({ name: `LPG Pools All ${suffix}`, allLocations: true }),
    ]);
    groupIds.scopedA = groups[0].id!;
    groupIds.scopedAB = groups[1].id!;
    groupIds.noServices = groups[2].id!;
    groupIds.inactive = groups[3].id!;
    groupIds.poolsAll = groups[4].id!;

    const category = await createServiceCategoryHs(`LPG Category ${suffix}`);
    groupIds.category = category.id!;
  }, 120_000);

  afterAll(async () => {
    for (const { resourceType, id } of created) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType, id });
      } catch {
        // best-effort
      }
    }
    if (cleanup) await cleanup();
  });

  it('summarizes composition, provider count, services, and active per group', async () => {
    const { groups } = await callList();
    const byId = new Map(groups.map((g) => [g.id, g]));

    const scopedA = byId.get(groupIds.scopedA);
    expect(scopedA, 'scoped-A group should be listed').toBeDefined();
    expect(scopedA!.poolsAllProviders).toBe(false);
    expect(scopedA!.locationNames).toEqual([locAName]);
    expect(scopedA!.providerCount).toBe(2);
    expect([...scopedA!.serviceLabels].sort()).toEqual(['Follow-up', 'Sick visit']);
    expect(scopedA!.active).toBe(true);

    const scopedAB = byId.get(groupIds.scopedAB);
    expect(scopedAB!.providerCount).toBe(3);
    expect([...scopedAB!.locationNames].sort()).toEqual([locAName, locBName].sort());

    const noServices = byId.get(groupIds.noServices);
    // Empty type[] => no service restriction (UI renders "All services").
    expect(noServices!.serviceLabels).toEqual([]);

    const inactive = byId.get(groupIds.inactive);
    expect(inactive!.active).toBe(false);

    const poolsAll = byId.get(groupIds.poolsAll);
    expect(poolsAll!.poolsAllProviders).toBe(true);
    expect(poolsAll!.locationNames).toEqual([]);
    // System-wide pool: at least our three active providers, can't assert exact.
    expect(poolsAll!.providerCount).toBeGreaterThanOrEqual(3);
  });

  it('excludes service-category HealthcareServices from the groups list', async () => {
    const { groups } = await callList();
    expect(groups.find((g) => g.id === groupIds.category)).toBeUndefined();
  });
});
