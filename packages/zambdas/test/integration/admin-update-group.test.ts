import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { HealthcareService, Location } from 'fhir/r4b';
import {
  getGroupAllLocations,
  getGroupAssignmentMode,
  INTEGRATION_TEST_TAG_SYSTEM,
  M2MClientMockType,
  SCHEDULE_STRATEGY_SYSTEM,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  serviceCategoryCharacteristics,
  ServiceMode,
  ServiceVisitType,
  SLUG_SYSTEM,
} from 'utils';
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Pins the zambda's replacement of the client-side patch composition that
// used to live in GroupPage.tsx — every case here maps to a field the old
// code touched via direct FHIR transaction. Focus is on the invariants that
// would silently corrupt the persisted Group if the zambda ever regressed:
// slug uniqueness, service-category HS gate, allLocations force-clearing
// location[], foreign-characteristic preservation.
describe('admin-update-group', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  type TrackedResource = 'Location' | 'HealthcareService';
  const createdIds: Array<{ resourceType: TrackedResource; id: string }> = [];

  const track = <T extends { resourceType: string; id?: string }>(r: T): T => {
    if (r.id) createdIds.push({ resourceType: r.resourceType as TrackedResource, id: r.id });
    return r;
  };
  const tag = (): { meta: { tag: Array<{ system: string; code: string }> } } => ({
    meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
  });

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-update-group.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;
  }, 60_000);

  afterAll(async () => {
    for (const r of [...createdIds].reverse()) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: r.resourceType, id: r.id });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  const makeGroup = async (overrides: Partial<HealthcareService> = {}): Promise<HealthcareService & { id: string }> => {
    const created = track(
      await oystehrAdmin.fhir.create<HealthcareService>({
        resourceType: 'HealthcareService',
        active: true,
        name: `AUG Group ${randomUUID().slice(0, 8)}`,
        ...tag(),
        ...overrides,
      })
    );
    assert(created.id);
    return created as HealthcareService & { id: string };
  };

  const makeLocation = async (): Promise<Location & { id: string }> => {
    const loc = track(
      await oystehrAdmin.fhir.create<Location>({
        resourceType: 'Location',
        status: 'active',
        name: `AUG Loc ${randomUUID().slice(0, 8)}`,
        ...tag(),
      })
    );
    assert(loc.id);
    return loc as Location & { id: string };
  };

  const makeCategoryHs = async (): Promise<HealthcareService & { id: string }> => {
    const code = `aug-cat-${randomUUID().slice(0, 8)}`;
    const hs = track(
      await oystehrAdmin.fhir.create<HealthcareService>({
        resourceType: 'HealthcareService',
        active: true,
        name: code,
        meta: {
          tag: [SERVICE_CATEGORY_TAG, { system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }],
        },
        type: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code, display: code }] }],
        characteristic: serviceCategoryCharacteristics({
          modes: [ServiceMode['in-person']],
          visitTypes: [ServiceVisitType.prebook],
          durationMinutes: 30,
        }),
      })
    );
    assert(hs.id);
    return hs as HealthcareService & { id: string };
  };

  const invoke = async (input: Record<string, unknown>): Promise<{ group: HealthcareService }> => {
    const response = await oystehrZambdas.zambda.execute({ id: 'admin-update-group', ...input });
    return response.output as { group: HealthcareService };
  };

  // Catch-and-return-message pattern shared across the admin-* integration
  // tests (see admin-service-categories.test.ts / admin-practitioner-role.test.ts).
  // We use it instead of `.rejects.toThrow(regex)` because the OystehrSdkError
  // isn't guaranteed to be a proper Error subclass — its String() coercion
  // can fall back to '[object Object]' even when the underlying `.message`
  // property carries the admin-facing prose. Pulling `.message` off the
  // object directly is what every other integration test does.
  const invokeExpectingRejection = async (input: Record<string, unknown>): Promise<{ message: string }> => {
    let caught: unknown;
    try {
      await oystehrZambdas.zambda.execute({ id: 'admin-update-group', ...input });
    } catch (e) {
      caught = e;
    }
    if (!caught) throw new Error('expected admin-update-group to reject the payload but it succeeded');
    const err = caught as { message?: string };
    return { message: err.message ?? '' };
  };

  it('updates the name', async () => {
    const group = await makeGroup();
    const newName = `Renamed ${randomUUID().slice(0, 8)}`;
    const { group: updated } = await invoke({ groupId: group.id, name: newName });
    expect(updated.name).toBe(newName);
    const fetched = await oystehrAdmin.fhir.get<HealthcareService>({
      resourceType: 'HealthcareService',
      id: group.id,
    });
    expect(fetched.name).toBe(newName);
  });

  it('adds a slug identifier when none existed', async () => {
    const group = await makeGroup();
    const slug = `aug-slug-${randomUUID().slice(0, 8)}`;
    const { group: updated } = await invoke({ groupId: group.id, slug });
    expect(updated.identifier?.some((i) => i.system === SLUG_SYSTEM && i.value === slug)).toBe(true);
  });

  it('clears the slug identifier when passed empty string', async () => {
    const initialSlug = `aug-clear-${randomUUID().slice(0, 8)}`;
    const group = await makeGroup({
      identifier: [{ system: SLUG_SYSTEM, value: initialSlug }],
    });
    const { group: updated } = await invoke({ groupId: group.id, slug: '' });
    expect(updated.identifier?.some((i) => i.system === SLUG_SYSTEM)).toBe(false);
  });

  it('rejects a slug that collides with another Group', async () => {
    const collidingSlug = `aug-collide-${randomUUID().slice(0, 8)}`;
    // Occupant group already owns the slug — a second group trying the same
    // slug should get bounced by the uniqueness gate before writing.
    await makeGroup({
      identifier: [{ system: SLUG_SYSTEM, value: collidingSlug }],
    });
    const target = await makeGroup();
    const { message } = await invokeExpectingRejection({ groupId: target.id, slug: collidingSlug });
    expect(message).toMatch(/already used/i);
  });

  it('rejects a slug that does not match the URL-safe format', async () => {
    const group = await makeGroup();
    // Uppercase + space are the two easiest ways to break the slug regex —
    // both would produce URLs that look right in the admin UI but fail on
    // the patient-side booking route.
    await invokeExpectingRejection({ groupId: group.id, slug: 'Not A Valid Slug' });
  });

  it('replaces locationIds with the passed list', async () => {
    const locA = await makeLocation();
    const locB = await makeLocation();
    const group = await makeGroup({ location: [{ reference: `Location/${locA.id}` }] });
    const { group: updated } = await invoke({ groupId: group.id, locationIds: [locB.id] });
    expect(updated.location?.map((l) => l.reference)).toEqual([`Location/${locB.id}`]);
  });

  it('force-clears location[] when allLocations=true regardless of locationIds passed', async () => {
    const locA = await makeLocation();
    const locB = await makeLocation();
    const group = await makeGroup({ location: [{ reference: `Location/${locA.id}` }] });
    // Client can send both allLocations=true AND a locationIds list (e.g., a
    // stale form state). The zambda MUST prefer the toggle — the persisted
    // shape should reflect "pool everywhere" cleanly. If we honored
    // locationIds here, toggling all-locations off later would silently
    // re-attach whatever was in the form when it was toggled on.
    const { group: updated } = await invoke({
      groupId: group.id,
      allLocations: true,
      locationIds: [locB.id],
    });
    expect(updated.location ?? []).toEqual([]);
    expect(getGroupAllLocations(updated)).toBe(true);
  });

  it('writes .type[] built from category HS ids (code + display)', async () => {
    const cat = await makeCategoryHs();
    const catCode = cat.type?.[0]?.coding?.[0]?.code;
    assert(catCode);
    const group = await makeGroup();
    const { group: updated } = await invoke({
      groupId: group.id,
      supportedCategoryHsIds: [cat.id],
    });
    expect(updated.type).toHaveLength(1);
    expect(updated.type?.[0].coding?.[0]).toMatchObject({
      system: SERVICE_CATEGORY_SYSTEM,
      code: catCode,
    });
  });

  it('rejects a supportedCategoryHsIds entry that references a non-service-category HealthcareService', async () => {
    // Fresh HS with no SERVICE_CATEGORY_TAG — passing it in would let an
    // admin sneak an arbitrary HS into the Group's category allow-list,
    // which downstream code would read as a legitimate category and try to
    // book against.
    const bogus = track(
      await oystehrAdmin.fhir.create<HealthcareService>({
        resourceType: 'HealthcareService',
        active: true,
        name: `AUG NotACategory ${randomUUID().slice(0, 8)}`,
        ...tag(),
      })
    );
    const group = await makeGroup();
    const { message } = await invokeExpectingRejection({
      groupId: group.id,
      supportedCategoryHsIds: [bogus.id!],
    });
    expect(message).toMatch(/not tagged as a service category/i);
  });

  it('rejects a supportedCategoryHsIds entry that does not exist in FHIR', async () => {
    const group = await makeGroup();
    // Use a UUID-shaped id so this test isolates the "id is well-formed but
    // doesn't resolve" case. The zambda's fhir.search for `_id=<uuid>` returns
    // an empty bundle for a nonexistent id (rather than throwing on shape),
    // so the code path exercised is the map-miss → INVALID_INPUT_ERROR branch
    // — exactly what this test is pinning.
    const { message } = await invokeExpectingRejection({
      groupId: group.id,
      supportedCategoryHsIds: [randomUUID()],
    });
    expect(message).toMatch(/not found/i);
  });

  it('writes group characteristics from assignmentMode + allLocations', async () => {
    const group = await makeGroup();
    const { group: updated } = await invoke({
      groupId: group.id,
      assignmentMode: 'provider',
      allLocations: false,
    });
    expect(getGroupAssignmentMode(updated)).toBe('provider');
    expect(getGroupAllLocations(updated)).toBe(false);
  });

  it('always writes the pools-providers strategy coding when characteristics are touched', async () => {
    // The strategy is what downstream slot resolution keys off — writing a
    // Group without it would leave existing bookings orphaned. Every save
    // that touches characteristics must re-stamp it.
    const group = await makeGroup();
    const { group: updated } = await invoke({
      groupId: group.id,
      assignmentMode: 'anonymous',
    });
    const strategyCodes = (updated.characteristic ?? [])
      .flatMap((cc) => cc.coding ?? [])
      .filter((c) => c.system === SCHEDULE_STRATEGY_SYSTEM)
      .map((c) => c.code);
    expect(strategyCodes).toContain('pools-providers');
  });

  it('preserves foreign-system characteristics when writing group characteristics', async () => {
    // Some other subsystem might stamp its own characteristic coding onto
    // the Group (e.g., a coverage-area marker). mergeOwnedCharacteristics
    // must leave it alone; a blanket replace would silently drop it and the
    // owning subsystem would see intermittent regressions on every Group
    // save.
    const foreignSystem = 'https://example.com/CodeSystem/foreign-marker';
    const group = await makeGroup({
      characteristic: [{ coding: [{ system: foreignSystem, code: 'test-foreign' }] }],
    });
    const { group: updated } = await invoke({
      groupId: group.id,
      assignmentMode: 'anonymous',
    });
    const foreignCodes = (updated.characteristic ?? [])
      .flatMap((cc) => cc.coding ?? [])
      .filter((c) => c.system === foreignSystem)
      .map((c) => c.code);
    expect(foreignCodes).toContain('test-foreign');
  });

  it('rejects when no update fields are provided', async () => {
    const group = await makeGroup();
    const { message } = await invokeExpectingRejection({ groupId: group.id });
    expect(message).toMatch(/at least one of/i);
  });

  it('validation: missing groupId', async () => {
    await invokeExpectingRejection({ name: 'x' });
  });
});
