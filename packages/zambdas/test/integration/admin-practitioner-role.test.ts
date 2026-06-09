import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import {
  INTEGRATION_TEST_TAG_SYSTEM,
  M2MClientMockType,
  PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL,
  SCHEDULE_DISPLAY_NAME_EXTENSION_URL,
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
    if (testLocation.id) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'Location', id: testLocation.id });
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

  const callCreate = async (
    overrides: { allCategories?: boolean; categoryHealthcareServiceIds?: string[] } = {}
  ): Promise<{ role: PractitionerRole; schedule: Schedule }> => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'admin-create-practitioner-role',
      practitionerId: testPractitioner.id,
      locationId: testLocation.id,
      categoryHealthcareServiceIds: overrides.categoryHealthcareServiceIds ?? [],
      timezone: TIMEZONES[0],
      ...(overrides.allCategories !== undefined ? { allCategories: overrides.allCategories } : {}),
    });
    const out = response.output as { role: PractitionerRole; schedule: Schedule };
    if (out.role.id) createdPrIds.push(out.role.id);
    if (out.schedule.id) createdScheduleIds.push(out.schedule.id);
    return out;
  };

  const callUpdate = async (
    roleId: string,
    body: { allCategories?: boolean; displayName?: string; categoryHealthcareServiceIds?: string[] }
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
});
