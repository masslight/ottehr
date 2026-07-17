import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import {
  APIErrorCode,
  INTEGRATION_TEST_TAG_SYSTEM,
  M2MClientMockType,
  PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL,
  SCHEDULE_DISPLAY_NAME_EXTENSION_URL,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  serviceCategoryCharacteristics,
  ServiceMode,
  ServiceVisitType,
  TIMEZONES,
} from 'utils';
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Integration coverage for the PR-level "offers all services" toggle. The
// toggle is the explicit replacement for the historical implicit "empty
// healthcareService[] = all services" semantic. It is persisted as a
// boolean PR extension at PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL,
// flowing through the admin-create + admin-update zambdas and read back via
// `getPractitionerRoleAllCategories`. These tests pin the read/write
// round-trip at the zambda boundary so the new contract can't silently
// regress.
describe('admin-create-practitioner-role + admin-update-practitioner-role — allCategories toggle', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  let testPractitioner: Practitioner;
  let testLocation: Location;
  const createdPrIds: string[] = [];
  const createdScheduleIds: string[] = [];
  const createdServiceCategoryIds: string[] = [];
  let secondTestLocation: Location;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-practitioner-role.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;

    testPractitioner = await oystehrAdmin.fhir.create<Practitioner>({
      resourceType: 'Practitioner',
      active: true,
      name: [{ given: ['Test'], family: `PR-${randomUUID().slice(0, 8)}` }],
      meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
    });
    assert(testPractitioner.id);

    testLocation = await oystehrAdmin.fhir.create<Location>({
      resourceType: 'Location',
      status: 'active',
      name: `PR Test Location ${randomUUID().slice(0, 8)}`,
      meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
    });
    assert(testLocation.id);

    // Second Location is used to verify the conflict check is location-scoped:
    // a candidate that overlaps services with an existing PR at a DIFFERENT
    // location shouldn't conflict.
    secondTestLocation = await oystehrAdmin.fhir.create<Location>({
      resourceType: 'Location',
      status: 'active',
      name: `PR Test Location 2 ${randomUUID().slice(0, 8)}`,
      meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
    });
    assert(secondTestLocation.id);
  }, 60_000);

  afterAll(async () => {
    for (const id of createdScheduleIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'Schedule', id });
      } catch {
        // best-effort
      }
    }
    for (const id of createdPrIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'PractitionerRole', id });
      } catch {
        // best-effort
      }
    }
    for (const id of createdServiceCategoryIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'HealthcareService', id });
      } catch {
        // best-effort
      }
    }
    for (const loc of [testLocation, secondTestLocation]) {
      if (loc?.id) {
        try {
          await oystehrAdmin.fhir.delete({ resourceType: 'Location', id: loc.id });
        } catch {
          // best-effort
        }
      }
    }
    for (const id of createdLocationIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'Location', id });
      } catch {
        // best-effort
      }
    }
    if (testPractitioner.id) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'Practitioner', id: testPractitioner.id });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  // Helper: create a FHIR-backed service-category HS so the conflict tests can
  // reference real category ids in healthcareService[].
  const createServiceCategoryHs = async (): Promise<HealthcareService> => {
    const code = `pr-conflict-${randomUUID().slice(0, 8)}`;
    const created = await oystehrAdmin.fhir.create<HealthcareService>({
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
    });
    assert(created.id);
    createdServiceCategoryIds.push(created.id);
    return created;
  };

  // Each created PR conflicts with any other PR at the same (practitioner,
  // location) that overlaps services — so cross-test pollution would happen
  // if every test reused testLocation. Default to a per-call fresh Location
  // so each test is independent; conflict tests pass an explicit locationId
  // to force the collision they need.
  const createdLocationIds: string[] = [];
  const makeFreshLocation = async (): Promise<Location> => {
    const loc = await oystehrAdmin.fhir.create<Location>({
      resourceType: 'Location',
      status: 'active',
      name: `PR Test Loc ${randomUUID().slice(0, 8)}`,
      meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
    });
    assert(loc.id);
    createdLocationIds.push(loc.id);
    return loc;
  };

  const callCreate = async (
    overrides: { allCategories?: boolean; categoryHealthcareServiceIds?: string[]; locationId?: string } = {}
  ): Promise<{ role: PractitionerRole; schedule: Schedule }> => {
    const locationId = overrides.locationId ?? (await makeFreshLocation()).id!;
    const response = await oystehrZambdas.zambda.execute({
      id: 'admin-create-practitioner-role',
      practitionerId: testPractitioner.id,
      locationId,
      categoryHealthcareServiceIds: overrides.categoryHealthcareServiceIds ?? [],
      timezone: TIMEZONES[0],
      ...(overrides.allCategories !== undefined ? { allCategories: overrides.allCategories } : {}),
    });
    const out = response.output as { role: PractitionerRole; schedule: Schedule };
    if (out.role.id) createdPrIds.push(out.role.id);
    if (out.schedule.id) createdScheduleIds.push(out.schedule.id);
    return out;
  };

  // Helper: attempt a create that's expected to be rejected by the conflict
  // check. The zambda throws PRACTITIONER_SCHEDULE_CONFLICT_ERROR, which
  // wrapHandler serializes as a 400 with `{ code, message }`; the SDK
  // surfaces those on the OystehrSdkError. `code` is the numeric APIErrorCode
  // value (the convention for every throw-APIError path in the codebase) and
  // `message` is the admin-facing prose. We assert on both.
  const callCreateExpectingConflict = async (overrides: {
    allCategories?: boolean;
    categoryHealthcareServiceIds?: string[];
    locationId?: string;
  }): Promise<{ code?: number; message: string }> => {
    let caught: unknown;
    try {
      await oystehrZambdas.zambda.execute({
        id: 'admin-create-practitioner-role',
        practitionerId: testPractitioner.id,
        locationId: overrides.locationId ?? testLocation.id,
        categoryHealthcareServiceIds: overrides.categoryHealthcareServiceIds ?? [],
        timezone: TIMEZONES[0],
        ...(overrides.allCategories !== undefined ? { allCategories: overrides.allCategories } : {}),
      });
    } catch (e) {
      caught = e;
    }
    if (!caught) {
      throw new Error('expected create to be rejected by the conflict check, but it succeeded');
    }
    const err = caught as { code?: number; message?: string };
    return { code: err.code, message: err.message ?? '' };
  };

  const callUpdate = async (
    roleId: string,
    body: {
      allCategories?: boolean;
      displayName?: string;
      categoryHealthcareServiceIds?: string[];
      locationId?: string;
    }
  ): Promise<PractitionerRole> => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'admin-update-practitioner-role',
      roleId,
      ...body,
    });
    return (response.output as { role: PractitionerRole }).role;
  };

  const readBackPr = async (roleId: string): Promise<PractitionerRole> => {
    return oystehrAdmin.fhir.get<PractitionerRole>({ resourceType: 'PractitionerRole', id: roleId });
  };

  const hasAllCategoriesExtension = (role: PractitionerRole): boolean =>
    (role.extension ?? []).some(
      (ext) => ext.url === PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL && ext.valueBoolean === true
    );

  it('create with allCategories=true persists the extension on the resulting PR', async () => {
    const { role } = await callCreate({ allCategories: true });
    assert(role.id);
    const refreshed = await readBackPr(role.id);
    expect(hasAllCategoriesExtension(refreshed)).toBe(true);
  });

  it('create without allCategories defaults to no extension on the resulting PR', async () => {
    const { role } = await callCreate({});
    assert(role.id);
    const refreshed = await readBackPr(role.id);
    expect(hasAllCategoriesExtension(refreshed)).toBe(false);
  });

  it('update can flip the toggle on for a PR that started with it off', async () => {
    const { role } = await callCreate({});
    assert(role.id);
    await callUpdate(role.id, { allCategories: true });
    const refreshed = await readBackPr(role.id);
    expect(hasAllCategoriesExtension(refreshed)).toBe(true);
  });

  it('update can flip the toggle off for a PR that started with it on', async () => {
    const { role } = await callCreate({ allCategories: true });
    assert(role.id);
    await callUpdate(role.id, { allCategories: false });
    const refreshed = await readBackPr(role.id);
    expect(hasAllCategoriesExtension(refreshed)).toBe(false);
  });

  it('update with only allCategories preserves the existing display-name extension', async () => {
    const { role } = await callCreate({});
    assert(role.id);
    // Seed a display name via the same zambda path the UI uses.
    await callUpdate(role.id, { displayName: 'Original Name' });
    // Now toggle on all-categories without touching displayName.
    await callUpdate(role.id, { allCategories: true });
    const refreshed = await readBackPr(role.id);
    const displayExt = (refreshed.extension ?? []).find((ext) => ext.url === SCHEDULE_DISPLAY_NAME_EXTENSION_URL);
    expect(displayExt?.valueString).toBe('Original Name');
    expect(hasAllCategoriesExtension(refreshed)).toBe(true);
  });

  it('update with only displayName preserves the all-categories toggle', async () => {
    const { role } = await callCreate({ allCategories: true });
    assert(role.id);
    await callUpdate(role.id, { displayName: 'Renamed' });
    const refreshed = await readBackPr(role.id);
    expect(hasAllCategoriesExtension(refreshed)).toBe(true);
    const displayExt = (refreshed.extension ?? []).find((ext) => ext.url === SCHEDULE_DISPLAY_NAME_EXTENSION_URL);
    expect(displayExt?.valueString).toBe('Renamed');
  });

  // The conflict check exists to prevent two active PRs for the same
  // (practitioner, location) tuple from offering overlapping services.
  // Pre-toggle, that overlap was strictly an intersection of two specific
  // category lists. With the explicit all-categories toggle, "offers every
  // service" becomes another way two PRs can overlap, and the check has to
  // handle it on both sides of the comparison.
  describe('conflict detection — allCategories toggle', () => {
    it('rejects a new PR with allCategories=true when an existing PR at the same Location offers a specific category', async () => {
      const sharedLocation = await makeFreshLocation();
      const cat = await createServiceCategoryHs();
      // Existing PR: specific cats at sharedLocation.
      await callCreate({ categoryHealthcareServiceIds: [cat.id!], locationId: sharedLocation.id! });

      // Candidate: allCategories=true at the same location — should conflict
      // because the candidate's "any" overlaps the existing PR's specific cat.
      const errorBody = await callCreateExpectingConflict({
        allCategories: true,
        locationId: sharedLocation.id!,
      });
      expect(errorBody.code).toBe(APIErrorCode.PRACTITIONER_SCHEDULE_CONFLICT);
      expect(errorBody.message).toContain(cat.name ?? '');
    });

    it('rejects a new PR with specific categories when an existing PR at the same Location has allCategories=true', async () => {
      const sharedLocation = await makeFreshLocation();
      // Existing PR: allCategories=true at sharedLocation.
      await callCreate({ allCategories: true, locationId: sharedLocation.id! });

      const cat = await createServiceCategoryHs();
      // Candidate: specific cats at the same location — should conflict
      // because the existing PR's "any" overlaps the candidate's specific cat.
      const errorBody = await callCreateExpectingConflict({
        categoryHealthcareServiceIds: [cat.id!],
        locationId: sharedLocation.id!,
      });
      expect(errorBody.code).toBe(APIErrorCode.PRACTITIONER_SCHEDULE_CONFLICT);
      expect(errorBody.message).toContain('All services');
    });

    it('rejects when an update flips a PR to allCategories=true while another PR at the same location offers specific cats', async () => {
      const sharedLocation = await makeFreshLocation();
      // First PR: specific cats at sharedLocation.
      const cat = await createServiceCategoryHs();
      await callCreate({ categoryHealthcareServiceIds: [cat.id!], locationId: sharedLocation.id! });

      // Second PR: lives at a different Location, allCategories=false. We'll
      // try to update it to the shared location with allCategories=true and
      // expect a conflict.
      const isolatedLocation = await makeFreshLocation();
      const { role: secondRole } = await callCreate({
        categoryHealthcareServiceIds: [],
        allCategories: false,
        locationId: isolatedLocation.id!,
      });
      assert(secondRole.id);

      // The second PR has nothing to offer (no cats, toggle off). Without the
      // toggle change the update would pass even though it moves the PR onto
      // the same Location as the first — there's no overlap to detect. The
      // conflict only emerges because we're also flipping the toggle on,
      // which is exactly what the test is here to catch.
      let caught: unknown;
      try {
        await callUpdate(secondRole.id, { locationId: sharedLocation.id!, allCategories: true });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeDefined();
      const err = caught as { code?: number; message?: string };
      expect(err.code).toBe(APIErrorCode.PRACTITIONER_SCHEDULE_CONFLICT);
      expect(err.message ?? '').toContain(cat.name ?? '');
    });

    // `healthcareService[]` is overloaded — it carries service-category refs
    // *and* group-membership refs. Only the former count toward conflict
    // overlap. Without filtering, a PR that's only a group member (and offers
    // no real categories) would falsely block an allCategories PR at the same
    // location.
    it('ignores non-service-category healthcareService refs on the other PR when checking overlap', async () => {
      const sharedLocation = await makeFreshLocation();

      // Create a non-category HS — no SERVICE_CATEGORY_TAG, no category tag.
      // Mimics a group-membership-style HS reference that may live on a PR.
      const nonCategoryHs = await oystehrAdmin.fhir.create<HealthcareService>({
        resourceType: 'HealthcareService',
        active: true,
        name: `pr-conflict-noncat-${randomUUID().slice(0, 8)}`,
        meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
      });
      assert(nonCategoryHs.id);
      createdServiceCategoryIds.push(nonCategoryHs.id);

      // Existing PR: at sharedLocation, no allCategories, only references the
      // non-category HS. The conflict check should treat this as "offers
      // nothing" — its single ref isn't a service category.
      const existingRole = await oystehrAdmin.fhir.create<PractitionerRole>({
        resourceType: 'PractitionerRole',
        active: true,
        practitioner: { reference: `Practitioner/${testPractitioner.id}` },
        location: [{ reference: `Location/${sharedLocation.id}` }],
        healthcareService: [{ reference: `HealthcareService/${nonCategoryHs.id}` }],
        meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
      });
      assert(existingRole.id);
      createdPrIds.push(existingRole.id);

      // New PR: allCategories=true at the same location. Without the filter,
      // the existing PR's non-category ref would count as a service offer and
      // we'd false-positive a conflict. With the filter, this should succeed.
      const { role } = await callCreate({
        allCategories: true,
        locationId: sharedLocation.id!,
      });
      assert(role.id);
    });

    // Inverse of the previous test, for the candidate side. UPDATE may pass
    // through the existing PR's full `healthcareService[]` (group refs and
    // all) as candidate.categoryHsIds. Without filtering, a candidate whose
    // only ref is a group-membership HS would non-emptily collide with any
    // other PR that has allCategories=true at the same location — a false
    // positive on a no-op-ish update.
    it('ignores non-service-category healthcareService refs on the candidate when checking overlap', async () => {
      const sharedLocation = await makeFreshLocation();

      // Existing PR at sharedLocation, allCategories=true. Created via the
      // zambda so the conflict check sees a real candidate-vs-this scenario
      // on the subsequent update.
      const { role: otherRole } = await callCreate({
        allCategories: true,
        locationId: sharedLocation.id!,
      });
      assert(otherRole.id);

      // Candidate PR: lives at an isolated Location, has only a non-category
      // (group-membership-style) ref in healthcareService[], no allCategories.
      // Built via raw FHIR so we can plant the non-category ref.
      const isolatedLocation = await makeFreshLocation();
      const nonCategoryHs = await oystehrAdmin.fhir.create<HealthcareService>({
        resourceType: 'HealthcareService',
        active: true,
        name: `pr-cand-noncat-${randomUUID().slice(0, 8)}`,
        meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
      });
      assert(nonCategoryHs.id);
      createdServiceCategoryIds.push(nonCategoryHs.id);

      const candidateRole = await oystehrAdmin.fhir.create<PractitionerRole>({
        resourceType: 'PractitionerRole',
        active: true,
        practitioner: { reference: `Practitioner/${testPractitioner.id}` },
        location: [{ reference: `Location/${isolatedLocation.id}` }],
        healthcareService: [{ reference: `HealthcareService/${nonCategoryHs.id}` }],
        meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
      });
      assert(candidateRole.id);
      createdPrIds.push(candidateRole.id);

      // Move the candidate to sharedLocation without touching categories or
      // toggling allCategories. The conflict check fires because the outer
      // guard sees non-empty targetCategoryIds (the group ref), but it should
      // be a no-op — the group ref isn't a category offer, so there's no
      // overlap with the other PR's allCategories=true.
      await callUpdate(candidateRole.id, { locationId: sharedLocation.id! });
    });
  });
});

// Coverage for the soft-delete/reactivate zambda that backs the Active toggle
// in the admin schedule list. The lifecycle has two non-trivial behaviors:
//
//   1. Both PR.active and the attached Schedule.active flip together — the PR
//      filter is what hides a soft-deleted row from admin lists, but
//      Schedule.active is kept in lockstep so the resource graph stays
//      coherent.
//   2. Reactivation runs the same conflict guard as create/update — otherwise
//      the dance "deactivate A → create overlapping B → reactivate A" would
//      reintroduce the duplicate-coverage problem the guard exists to prevent.
//
// Validation errors (PR has no Schedule) and the conflict path are exercised
// alongside the happy paths so the load-bearing pieces all stay pinned.
describe('admin-set-practitioner-role-active — activation lifecycle', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  let testPractitioner: Practitioner;
  const createdPrIds: string[] = [];
  const createdScheduleIds: string[] = [];
  const createdServiceCategoryIds: string[] = [];
  const createdLocationIds: string[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-practitioner-role.test.ts:set-active', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;

    testPractitioner = await oystehrAdmin.fhir.create<Practitioner>({
      resourceType: 'Practitioner',
      active: true,
      name: [{ given: ['SetActive'], family: `Test-${randomUUID().slice(0, 8)}` }],
      meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
    });
    assert(testPractitioner.id);
  }, 60_000);

  afterAll(async () => {
    for (const id of createdScheduleIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'Schedule', id });
      } catch {
        // best-effort
      }
    }
    for (const id of createdPrIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'PractitionerRole', id });
      } catch {
        // best-effort
      }
    }
    for (const id of createdServiceCategoryIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'HealthcareService', id });
      } catch {
        // best-effort
      }
    }
    for (const id of createdLocationIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'Location', id });
      } catch {
        // best-effort
      }
    }
    if (testPractitioner.id) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'Practitioner', id: testPractitioner.id });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  const makeFreshLocation = async (): Promise<Location> => {
    const loc = await oystehrAdmin.fhir.create<Location>({
      resourceType: 'Location',
      status: 'active',
      name: `Set-Active Test Loc ${randomUUID().slice(0, 8)}`,
      meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
    });
    assert(loc.id);
    createdLocationIds.push(loc.id);
    return loc;
  };

  const createServiceCategoryHs = async (): Promise<HealthcareService> => {
    const code = `set-active-${randomUUID().slice(0, 8)}`;
    const created = await oystehrAdmin.fhir.create<HealthcareService>({
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
    });
    assert(created.id);
    createdServiceCategoryIds.push(created.id);
    return created;
  };

  // Provision an active PR + Schedule via the same admin-create zambda the UI
  // uses, so the test subject is shaped exactly the way production resources
  // are shaped (extensions, references, all wired through the real handler).
  const createActivePr = async (
    overrides: {
      locationId?: string;
      categoryHealthcareServiceIds?: string[];
      allCategories?: boolean;
    } = {}
  ): Promise<{ role: PractitionerRole; schedule: Schedule }> => {
    const locationId = overrides.locationId ?? (await makeFreshLocation()).id!;
    const response = await oystehrZambdas.zambda.execute({
      id: 'admin-create-practitioner-role',
      practitionerId: testPractitioner.id,
      locationId,
      categoryHealthcareServiceIds: overrides.categoryHealthcareServiceIds ?? [],
      timezone: TIMEZONES[0],
      ...(overrides.allCategories !== undefined ? { allCategories: overrides.allCategories } : {}),
    });
    const out = response.output as { role: PractitionerRole; schedule: Schedule };
    if (out.role.id) createdPrIds.push(out.role.id);
    if (out.schedule.id) createdScheduleIds.push(out.schedule.id);
    return out;
  };

  const callSetActive = async (roleId: string, active: boolean): Promise<void> => {
    await oystehrZambdas.zambda.execute({
      id: 'admin-set-practitioner-role-active',
      roleId,
      active,
    });
  };

  const readPr = (roleId: string): Promise<PractitionerRole> =>
    oystehrAdmin.fhir.get<PractitionerRole>({ resourceType: 'PractitionerRole', id: roleId });
  const readSchedule = (scheduleId: string): Promise<Schedule> =>
    oystehrAdmin.fhir.get<Schedule>({ resourceType: 'Schedule', id: scheduleId });

  it('deactivation flips both PractitionerRole.active and Schedule.active to false', async () => {
    const { role, schedule } = await createActivePr({ allCategories: true });
    assert(role.id);
    assert(schedule.id);

    await callSetActive(role.id, false);

    const [refreshedPr, refreshedSchedule] = await Promise.all([readPr(role.id), readSchedule(schedule.id)]);
    expect(refreshedPr.active).toBe(false);
    expect(refreshedSchedule.active).toBe(false);
  });

  it('reactivation restores both PractitionerRole.active and Schedule.active to true', async () => {
    const { role, schedule } = await createActivePr({ allCategories: true });
    assert(role.id);
    assert(schedule.id);

    await callSetActive(role.id, false);
    await callSetActive(role.id, true);

    const [refreshedPr, refreshedSchedule] = await Promise.all([readPr(role.id), readSchedule(schedule.id)]);
    expect(refreshedPr.active).toBe(true);
    expect(refreshedSchedule.active).toBe(true);
  });

  it('rejects reactivation when another active PR now covers the same (location, category) tuple', async () => {
    // PR-A and PR-B both want the same coverage. Create A, deactivate it,
    // create B in its place (which passes because A is inactive), then try
    // to reactivate A — the guard should fire so we don't end up with both
    // active for the same tuple.
    const sharedLocation = await makeFreshLocation();
    const cat = await createServiceCategoryHs();
    const { role: roleA } = await createActivePr({
      locationId: sharedLocation.id!,
      categoryHealthcareServiceIds: [cat.id!],
    });
    assert(roleA.id);

    await callSetActive(roleA.id, false);

    await createActivePr({
      locationId: sharedLocation.id!,
      categoryHealthcareServiceIds: [cat.id!],
    });

    let caught: unknown;
    try {
      await callSetActive(roleA.id, true);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    const err = caught as { code?: number; message?: string };
    expect(err.code).toBe(APIErrorCode.PRACTITIONER_SCHEDULE_CONFLICT);
    expect(err.message ?? '').toContain(cat.name ?? '');

    // A must still be inactive — the guard fired before any patches ran.
    const refreshedA = await readPr(roleA.id);
    expect(refreshedA.active).toBe(false);
  });

  it('throws Schedule-not-found when the PR has no attached Schedule', async () => {
    // Plant a PR directly so we can isolate the missing-Schedule path —
    // admin-create always pairs a PR with a Schedule, so the only way to
    // hit this branch in a test is to build the PR with raw FHIR.
    const loc = await makeFreshLocation();
    const role = await oystehrAdmin.fhir.create<PractitionerRole>({
      resourceType: 'PractitionerRole',
      active: true,
      practitioner: { reference: `Practitioner/${testPractitioner.id}` },
      location: [{ reference: `Location/${loc.id}` }],
      meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
    });
    assert(role.id);
    createdPrIds.push(role.id);

    let caught: unknown;
    try {
      await callSetActive(role.id, false);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    const err = caught as { code?: number; message?: string };
    expect(err.code).toBe(APIErrorCode.FHIR_RESOURCE_NOT_FOUND);
  });

  it('refuses to act when multiple Schedules reference the same PR — and leaves resources untouched', async () => {
    // The zambda's invariant is "exactly one Schedule per PR." Multi-Schedule
    // is a data anomaly we expect never to happen in production, but if it
    // does, we want a hard bail rather than an arbitrary pick — picking one
    // would leave the other in a divergent active state. Plant the anomaly
    // with raw FHIR, then assert that (a) the call throws and (b) no patches
    // ran (PR.active and both Schedule.active stay at their pre-call values).
    const loc = await makeFreshLocation();
    const role = await oystehrAdmin.fhir.create<PractitionerRole>({
      resourceType: 'PractitionerRole',
      active: true,
      practitioner: { reference: `Practitioner/${testPractitioner.id}` },
      location: [{ reference: `Location/${loc.id}` }],
      meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
    });
    assert(role.id);
    createdPrIds.push(role.id);

    const buildSchedule = (): Schedule => ({
      resourceType: 'Schedule',
      active: true,
      actor: [{ reference: `PractitionerRole/${role.id}` }],
      meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
    });
    const [scheduleA, scheduleB] = await Promise.all([
      oystehrAdmin.fhir.create<Schedule>(buildSchedule()),
      oystehrAdmin.fhir.create<Schedule>(buildSchedule()),
    ]);
    assert(scheduleA.id);
    assert(scheduleB.id);
    createdScheduleIds.push(scheduleA.id, scheduleB.id);

    let caught: unknown;
    try {
      await callSetActive(role.id, false);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();

    // Nothing should have mutated — partial deactivation would leave the
    // graph in a worse state than the original anomaly. Re-read all three
    // resources and check active flags are still true.
    const [refreshedPr, refreshedA, refreshedB] = await Promise.all([
      readPr(role.id),
      readSchedule(scheduleA.id),
      readSchedule(scheduleB.id),
    ]);
    expect(refreshedPr.active).toBe(true);
    expect(refreshedA.active).toBe(true);
    expect(refreshedB.active).toBe(true);
  });
});
