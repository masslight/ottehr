import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { HealthcareService } from 'fhir/r4b';
import {
  INTEGRATION_TEST_TAG_SYSTEM,
  M2MClientMockType,
  SERVICE_CATEGORIES_AVAILABLE,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  serviceCategoryCharacteristics,
  ServiceMode,
  ServiceVisitType,
  SLUG_SYSTEM,
} from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

  it('appends a non-colliding FHIR record alongside BOOKING_CONFIG, tagged source: fhir', async () => {
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
  });

  it('group scope returns only the categories declared in the group type[]', async () => {
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
  });

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
