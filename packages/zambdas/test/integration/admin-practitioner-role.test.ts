import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import {
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
  // check. The zambda returns a 400 with `{ code, message, ... }`; the SDK
  // turns that into an OystehrSdkError whose `.code` is the body's `code`
  // string and whose `.message` is the body's `message` prose. Other body
  // fields (conflictingPractitionerRoleId, conflictingCategoryNames) are dropped by
  // the SDK, so tests assert on the prose message instead.
  const callCreateExpectingConflict = async (overrides: {
    allCategories?: boolean;
    categoryHealthcareServiceIds?: string[];
    locationId?: string;
  }): Promise<{ code?: string | number; message: string }> => {
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
    const err = caught as { code?: string | number; message?: string };
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
      expect(errorBody.code).toBe('PRACTITIONER_SCHEDULE_CONFLICT');
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
      expect(errorBody.code).toBe('PRACTITIONER_SCHEDULE_CONFLICT');
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
      const err = caught as { code?: string | number; message?: string };
      expect(err.code).toBe('PRACTITIONER_SCHEDULE_CONFLICT');
      expect(err.message ?? '').toContain(cat.name ?? '');
    });
  });
});
