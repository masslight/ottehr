import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { HealthcareService, Location, Practitioner, PractitionerRole } from 'fhir/r4b';
import {
  FEATURE_FLAGS_CONFIG,
  INTEGRATION_TEST_TAG_SYSTEM,
  M2MClientMockType,
  PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL,
  SERVICE_CATEGORIES_AVAILABLE,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  serviceCategoryCharacteristics,
  ServiceMode,
  ServiceVisitType,
  SLUG_SYSTEM,
} from 'utils';
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

interface ServiceCategoryResponseEntry {
  code: string;
  name: string;
  source?: 'booking-config' | 'fhir';
  active: boolean;
  config: { durationMinutes: number };
}

interface GetServiceCategoriesResponse {
  serviceCategories: ServiceCategoryResponseEntry[];
}

const BOOKING_CONFIG_CODES = SERVICE_CATEGORIES_AVAILABLE.map((sc) => sc.category.code!).filter(Boolean);

// Whether the deployed zambda will surface FHIR-backed categories. Customer
// builds default to OFF (flag undefined → falsy); core builds to ON. The
// behavior we assert below changes accordingly: when ON, a created FHIR
// HealthcareService appears in the catalog; when OFF, the zambda skips the
// FHIR search entirely and the same record is correctly suppressed. Each
// branch gets its own assertion so this test passes against either build.
const DYNAMIC_CATS_ON = FEATURE_FLAGS_CONFIG.dynamicServiceCategoriesEnabled === true;

describe('get-service-categories integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let processId: string;
  const createdResourceIds: string[] = [];

  const buildServiceCategoryResource = (code: string, name: string): HealthcareService => ({
    resourceType: 'HealthcareService',
    active: true,
    name,
    meta: {
      tag: [SERVICE_CATEGORY_TAG, { system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }],
    },
    type: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code, display: name }] }],
    characteristic: serviceCategoryCharacteristics({
      modes: [ServiceMode['in-person']],
      visitTypes: [ServiceVisitType.prebook],
      durationMinutes: 30,
    }),
  });

  const buildGroupResource = (slug: string, offeredCodes: string[]): HealthcareService => ({
    resourceType: 'HealthcareService',
    active: true,
    name: `Test Group ${slug}`,
    identifier: [{ system: SLUG_SYSTEM, value: slug }],
    type: offeredCodes.map((code) => ({
      coding: [{ system: SERVICE_CATEGORY_SYSTEM, code }],
    })),
    meta: {
      tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }],
    },
  });

  const createServiceCategory = async (code: string, name: string): Promise<HealthcareService> => {
    const created = await oystehrAdmin.fhir.create(buildServiceCategoryResource(code, name));
    if (created.id) createdResourceIds.push(created.id);
    return created;
  };

  const createGroup = async (slug: string, offeredCodes: string[]): Promise<HealthcareService> => {
    const created = await oystehrAdmin.fhir.create(buildGroupResource(slug, offeredCodes));
    if (created.id) createdResourceIds.push(created.id);
    return created;
  };

  // Practitioner/PractitionerRole/Location cleanup uses a different resource
  // type than the main HealthcareService pool, so track separately and sweep
  // in afterAll.
  const providerFixtureCleanup: Array<{ resourceType: 'Practitioner' | 'PractitionerRole' | 'Location'; id: string }> =
    [];

  interface CreatePrOpts {
    slug: string;
    healthcareServiceIds?: string[];
    allCategories?: boolean;
  }

  const createPractitionerRoleFixture = async (opts: CreatePrOpts): Promise<PractitionerRole> => {
    const location = await oystehrAdmin.fhir.create<Location>({
      resourceType: 'Location',
      status: 'active',
      name: `PR Test Location ${opts.slug}`,
      meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
    });
    // Assert ids immediately: FHIR create() returns typed `id?: string`
    // so a missing id would otherwise silently produce `Location/undefined`
    // references downstream and leak the resource past cleanup.
    assert(location.id, 'Location fixture missing id');
    providerFixtureCleanup.push({ resourceType: 'Location', id: location.id });

    const practitioner = await oystehrAdmin.fhir.create<Practitioner>({
      resourceType: 'Practitioner',
      active: true,
      name: [{ family: 'Provider', given: [`PR Test ${opts.slug}`] }],
      meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
    });
    assert(practitioner.id, 'Practitioner fixture missing id');
    providerFixtureCleanup.push({ resourceType: 'Practitioner', id: practitioner.id });

    const pr = await oystehrAdmin.fhir.create<PractitionerRole>({
      resourceType: 'PractitionerRole',
      active: true,
      practitioner: { reference: `Practitioner/${practitioner.id}` },
      location: [{ reference: `Location/${location.id}` }],
      identifier: [{ system: SLUG_SYSTEM, value: opts.slug }],
      healthcareService: (opts.healthcareServiceIds ?? []).map((id) => ({ reference: `HealthcareService/${id}` })),
      ...(opts.allCategories
        ? { extension: [{ url: PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL, valueBoolean: true }] }
        : {}),
      meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
    });
    assert(pr.id, 'PractitionerRole fixture missing id');
    providerFixtureCleanup.push({ resourceType: 'PractitionerRole', id: pr.id });
    return pr;
  };

  const callZambda = async (
    params: { scheduleType?: string; bookingOn?: string } = {}
  ): Promise<GetServiceCategoriesResponse> => {
    const response = await oystehrPatient.zambda.executePublic({
      id: 'get-service-categories',
      ...params,
    });
    return response.output as GetServiceCategoriesResponse;
  };

  const uniq = (suffix: string): string => `test-${processId.slice(0, 8)}-${suffix}`;

  beforeAll(async () => {
    processId = randomUUID();
    const setup = await setupIntegrationTest('get-service-categories.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
  }, 60_000);

  afterAll(async () => {
    // PractitionerRole first (it references the other two), then Practitioner
    // + Location. Order matters if the FHIR server enforces reference
    // integrity on delete.
    const providerOrder: Array<'PractitionerRole' | 'Practitioner' | 'Location'> = [
      'PractitionerRole',
      'Practitioner',
      'Location',
    ];
    for (const rt of providerOrder) {
      for (const entry of providerFixtureCleanup.filter((e) => e.resourceType === rt)) {
        try {
          await oystehrAdmin.fhir.delete({ resourceType: entry.resourceType, id: entry.id });
        } catch {
          // Best-effort cleanup; ignore individual deletion failures.
        }
      }
    }
    for (const id of createdResourceIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'HealthcareService', id });
      } catch {
        // Best-effort cleanup; ignore individual deletion failures.
      }
    }
  });

  it('endpoint is reachable and returns a serviceCategories array', async () => {
    const result = await callZambda();
    expect(result).toBeDefined();
    expect(Array.isArray(result.serviceCategories)).toBe(true);
  });

  it('returns every BOOKING_CONFIG entry, each tagged source: booking-config', async () => {
    const result = await callZambda();
    for (const code of BOOKING_CONFIG_CODES) {
      const entry = result.serviceCategories.find((c) => c.code === code);
      expect(entry, `expected BOOKING_CONFIG code ${code} in catalog`).toBeDefined();
      expect(entry?.source).toBe('booking-config');
    }
  });

  it.skipIf(!DYNAMIC_CATS_ON)(
    'appends a non-colliding FHIR record alongside BOOKING_CONFIG, tagged source: fhir (flag ON)',
    async () => {
      const fhirCode = uniq('appended');
      await createServiceCategory(fhirCode, 'Appended Service');

      const result = await callZambda();
      const fhirEntry = result.serviceCategories.find((c) => c.code === fhirCode);
      expect(fhirEntry).toBeDefined();
      expect(fhirEntry?.source).toBe('fhir');

      // BOOKING_CONFIG entries still present.
      for (const code of BOOKING_CONFIG_CODES) {
        expect(result.serviceCategories.find((c) => c.code === code)).toBeDefined();
      }
    }
  );

  it.skipIf(DYNAMIC_CATS_ON)('suppresses FHIR records while still returning BOOKING_CONFIG (flag OFF)', async () => {
    const fhirCode = uniq('appended-off');
    await createServiceCategory(fhirCode, 'Appended Service (off)');

    const result = await callZambda();
    // Flag OFF: the FHIR record we just created must NOT surface to
    // patients. Operator added it in admin (admin UI uses a different
    // zambda and would show it); patient flow stays clean.
    expect(result.serviceCategories.find((c) => c.code === fhirCode)).toBeUndefined();

    // BOOKING_CONFIG entries unaffected.
    for (const code of BOOKING_CONFIG_CODES) {
      expect(result.serviceCategories.find((c) => c.code === code)).toBeDefined();
    }
  });

  it.skipIf(!DYNAMIC_CATS_ON)(
    'group scope returns only the categories declared in the group type[] (flag ON)',
    async () => {
      const extraCode = uniq('grouped');
      await createServiceCategory(extraCode, 'Grouped Service');

      const includedBookingCode = BOOKING_CONFIG_CODES[0];
      const slug = uniq('group-scoped');
      await createGroup(slug, [includedBookingCode, extraCode]);

      const result = await callZambda({ scheduleType: 'group', bookingOn: slug });

      const returned = result.serviceCategories.map((c) => c.code).sort();
      expect(returned).toEqual([includedBookingCode, extraCode].sort());

      // Source tags survive scoping.
      expect(result.serviceCategories.find((c) => c.code === includedBookingCode)?.source).toBe('booking-config');
      expect(result.serviceCategories.find((c) => c.code === extraCode)?.source).toBe('fhir');
    }
  );

  it.skipIf(DYNAMIC_CATS_ON)(
    'group scope returns only the BOOKING_CONFIG codes the group declares; FHIR-declared codes are dropped (flag OFF)',
    async () => {
      const extraCode = uniq('grouped-off');
      await createServiceCategory(extraCode, 'Grouped Service (off)');

      const includedBookingCode = BOOKING_CONFIG_CODES[0];
      const slug = uniq('group-scoped-off');
      await createGroup(slug, [includedBookingCode, extraCode]);

      const result = await callZambda({ scheduleType: 'group', bookingOn: slug });

      // Flag OFF: the FHIR-declared code isn't in fullCatalog, so filtering
      // by the group's offered codes can't surface it. The group's
      // BOOKING_CONFIG declaration still resolves normally.
      const returned = result.serviceCategories.map((c) => c.code).sort();
      expect(returned).toEqual([includedBookingCode]);
      expect(result.serviceCategories.find((c) => c.code === includedBookingCode)?.source).toBe('booking-config');
    }
  );

  it('group with empty type[] returns the full catalog (admin grace period)', async () => {
    const slug = uniq('group-empty');
    await createGroup(slug, []);

    const result = await callZambda({ scheduleType: 'group', bookingOn: slug });

    for (const code of BOOKING_CONFIG_CODES) {
      expect(result.serviceCategories.find((c) => c.code === code)).toBeDefined();
    }
  });

  it('returns an empty array when the group slug does not resolve', async () => {
    const result = await callZambda({
      scheduleType: 'group',
      bookingOn: `nonexistent-${randomUUID()}`,
    });
    expect(result.serviceCategories).toEqual([]);
  });

  // Provider scope: for scheduleType='provider' + bookingOn=<PR slug>, the
  // returned catalog must intersect the PR's healthcareService[] refs. The
  // scoping is FHIR-driven (no BOOKING_CONFIG entries can validly appear on a
  // PR-owned schedule; get-schedule hard-excludes them). These tests pin:
  //   - only the PR's referenced categories are returned
  //   - unreferenced categories (even active FHIR ones in the catalog) are
  //     dropped
  //   - BOOKING_CONFIG entries never appear, regardless of PR state
  //   - the allCategories toggle returns every FHIR-backed category
  //   - unknown/misrouted slugs return an empty list, not a fallback
  //
  // Provider scoping always fetches FHIR resources regardless of the
  // dynamicServiceCategoriesEnabled flag, because the flag gates the general
  // patient catalog but a provider deeplink is by construction scoped to a
  // FHIR-credentialed provider. So these tests run on both flag branches.
  describe('provider scope', () => {
    it('returns only the categories referenced by the PR healthcareService[]', async () => {
      const offeredCode = uniq('pr-offered');
      const otherCode = uniq('pr-other');
      const offered = await createServiceCategory(offeredCode, 'Provider Offered');
      await createServiceCategory(otherCode, 'Provider Other');
      // Assert the id early so the PR fixture doesn't silently construct
      // itself with `healthcareServiceIds: []` when the create response is
      // typed `id?: string` — that would make the test pass vacuously.
      assert(offered.id, 'createServiceCategory returned no id');

      const slug = uniq('pr-scoped');
      await createPractitionerRoleFixture({ slug, healthcareServiceIds: [offered.id] });

      const result = await callZambda({ scheduleType: 'provider', bookingOn: slug });
      const returned = result.serviceCategories.map((c) => c.code).sort();

      // Assert: exactly the offered code, tagged source: fhir. Explicitly
      // check the sibling code was created but is absent — narrower than
      // "list length is 1" against a shared FHIR pool.
      expect(returned).toContain(offeredCode);
      expect(returned).not.toContain(otherCode);
      expect(result.serviceCategories.find((c) => c.code === offeredCode)?.source).toBe('fhir');
    });

    it('does not surface any BOOKING_CONFIG entries in the response', async () => {
      const offeredCode = uniq('pr-no-bc');
      const offered = await createServiceCategory(offeredCode, 'PR No BC');
      assert(offered.id, 'createServiceCategory returned no id');

      const slug = uniq('pr-no-bc-slug');
      await createPractitionerRoleFixture({ slug, healthcareServiceIds: [offered.id] });

      const result = await callZambda({ scheduleType: 'provider', bookingOn: slug });
      for (const code of BOOKING_CONFIG_CODES) {
        expect(result.serviceCategories.find((c) => c.code === code)).toBeUndefined();
      }
    });

    it('returns an empty list when the PR references no HealthcareServices and allCategories is off', async () => {
      const slug = uniq('pr-empty');
      await createPractitionerRoleFixture({ slug });

      const result = await callZambda({ scheduleType: 'provider', bookingOn: slug });
      expect(result.serviceCategories).toEqual([]);
    });

    it('returns every FHIR-backed category when the PR has allCategories=true', async () => {
      const codeA = uniq('all-a');
      const codeB = uniq('all-b');
      await createServiceCategory(codeA, 'All A');
      await createServiceCategory(codeB, 'All B');

      const slug = uniq('pr-all-cats');
      await createPractitionerRoleFixture({ slug, allCategories: true });

      const result = await callZambda({ scheduleType: 'provider', bookingOn: slug });
      const returned = result.serviceCategories.map((c) => c.code);
      expect(returned).toContain(codeA);
      expect(returned).toContain(codeB);
      // BOOKING_CONFIG stays excluded even for allCategories PRs.
      for (const code of BOOKING_CONFIG_CODES) {
        expect(returned).not.toContain(code);
      }
    });

    it('returns an empty list when the provider slug does not resolve', async () => {
      const result = await callZambda({
        scheduleType: 'provider',
        bookingOn: `nonexistent-${randomUUID()}`,
      });
      expect(result.serviceCategories).toEqual([]);
    });
  });

  // bookingOn is interpolated raw into a FHIR `identifier` search as
  // `${SLUG_SYSTEM}|${bookingOn}`. The validator enforces a URL-safe slug
  // shape to prevent breaking out of the value side and injecting extra
  // search clauses. These tests exercise that boundary.
  describe('bookingOn slug-format validation', () => {
    const expectRejection = async (bookingOn: string): Promise<void> => {
      let caught: unknown;
      try {
        await callZambda({ scheduleType: 'group', bookingOn });
      } catch (e) {
        caught = e;
      }
      if (!caught) {
        throw new Error(`expected zambda to reject bookingOn="${bookingOn}" but it succeeded`);
      }
      const msg = (caught as { message?: string })?.message ?? JSON.stringify(caught);
      expect(msg).toMatch(/bookingOn|slug/i);
    };

    it('rejects a bookingOn containing "|" (injection vector)', async () => {
      await expectRejection('legit-slug|extra-clause');
    });

    it('rejects a bookingOn containing a space', async () => {
      await expectRejection('legit slug');
    });

    it('rejects a bookingOn that is an empty string', async () => {
      await expectRejection('');
    });
  });
});
