import { Bundle, HealthcareService } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOOKING_CONFIG } from '../ottehr-config/booking';
import { SERVICE_CATEGORY_CONFIG_EXTENSION_URL, SERVICE_CATEGORY_SYSTEM, SERVICE_CATEGORY_TAG } from './constants';
import { resolveServiceCategory } from './serviceCategoryResolution';

// Mock Oystehr — only fhir.search is exercised by the resolver.
const mockSearch = vi.fn();
const mockOystehr = { fhir: { search: mockSearch } } as any;

// Build a bundle in the shape getAllFhirSearchPages reads: entry[] (with
// search.mode='match' counted toward currentIndex), total (loop terminator),
// and unbundle() returning the resources.
type CategoryBundle = Bundle<HealthcareService> & { unbundle: () => HealthcareService[] };
const makeBundle = (hses: HealthcareService[]): CategoryBundle => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: hses.length,
  entry: hses.map((hs) => ({ resource: hs, search: { mode: 'match' as const } })),
  unbundle: () => hses,
});

// FHIR-backed service-category HS with the configured runtime metadata the
// resolver reads (cadence/duration via characteristic[], reasons via the
// SERVICE_CATEGORY_CONFIG_EXTENSION_URL JSON blob).
const makeCategoryHs = (input: {
  code: string;
  name?: string;
  durationMinutes?: number;
  cadenceMinutes?: number;
  reasons?: Array<{ value: string; label: string }>;
}): HealthcareService => {
  const characteristic: HealthcareService['characteristic'] = [];
  if (input.durationMinutes !== undefined) {
    characteristic.push({
      coding: [
        {
          system: 'https://fhir.ottehr.com/CodeSystem/service-category-duration-minutes',
          code: String(input.durationMinutes),
        },
      ],
    });
  }
  if (input.cadenceMinutes !== undefined) {
    characteristic.push({
      coding: [
        {
          system: 'https://fhir.ottehr.com/CodeSystem/service-category-cadence-minutes',
          code: String(input.cadenceMinutes),
        },
      ],
    });
  }
  return {
    resourceType: 'HealthcareService',
    id: `hs-${input.code}`,
    name: input.name ?? input.code,
    meta: { tag: [SERVICE_CATEGORY_TAG] },
    type: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: input.code, display: input.name ?? input.code }] }],
    ...(characteristic.length > 0 ? { characteristic } : {}),
    ...(input.reasons
      ? {
          extension: [
            {
              url: SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
              valueString: JSON.stringify({ reasonsForVisit: input.reasons }),
            },
          ],
        }
      : {}),
  };
};

// A real BOOKING_CONFIG code we can rely on existing. Picking the first
// keeps the test resilient to reorderings.
const firstBookingConfigCode = BOOKING_CONFIG.serviceCategories[0]?.category.code;

describe('resolveServiceCategory', () => {
  beforeEach(() => {
    mockSearch.mockReset();
  });

  it('resolves a BOOKING_CONFIG entry without hitting FHIR', async () => {
    expect(firstBookingConfigCode).toBeTruthy();
    const code = firstBookingConfigCode!;

    const result = await resolveServiceCategory(code, mockOystehr);

    expect(result).toBeDefined();
    expect(result!.code).toBe(code);
    expect(result!.source).toBe('booking-config');
    // BOOKING_CONFIG entries don't carry runtime cadence/duration —
    // callers fall through to per-Schedule slot length. That fall-through
    // is the source of truth; if this ever changes, downstream code that
    // assumes "BOOKING_CONFIG means default cadence" needs to catch up.
    expect(result!.durationMinutes).toBeUndefined();
    expect(result!.cadenceMinutes).toBeUndefined();
    expect(Array.isArray(result!.reasonsForVisit)).toBe(true);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('prefers BOOKING_CONFIG over a colliding FHIR entry (BOOKING_CONFIG never consults FHIR)', async () => {
    // A FHIR entry with the same code as the BOOKING_CONFIG one. If the
    // resolver ever queried FHIR for BOOKING_CONFIG codes, this fixture
    // would let the FHIR cadence override the BOOKING_CONFIG default —
    // exactly the "admin can change production booking behavior by
    // creating a colliding row" scenario the precedence rule blocks.
    const collisionFhirHs = makeCategoryHs({
      code: firstBookingConfigCode!,
      name: 'Colliding FHIR Entry',
      durationMinutes: 99,
      cadenceMinutes: 99,
    });
    mockSearch.mockResolvedValueOnce(makeBundle([collisionFhirHs]));

    const result = await resolveServiceCategory(firstBookingConfigCode!, mockOystehr);

    expect(result!.source).toBe('booking-config');
    expect(result!.cadenceMinutes).toBeUndefined();
    expect(result!.durationMinutes).toBeUndefined();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('resolves a FHIR-backed admin category with cadence/duration/reasons', async () => {
    const adminCode = 'admin-acne-facial';
    const adminHs = makeCategoryHs({
      code: adminCode,
      name: 'Acne Facial',
      durationMinutes: 30,
      cadenceMinutes: 15,
      reasons: [{ value: 'cystic-acne', label: 'Cystic acne' }],
    });
    mockSearch.mockResolvedValueOnce(makeBundle([adminHs]));

    const result = await resolveServiceCategory(adminCode, mockOystehr);

    expect(result).toBeDefined();
    expect(result!.code).toBe(adminCode);
    expect(result!.source).toBe('fhir');
    expect(result!.display).toBe('Acne Facial');
    expect(result!.durationMinutes).toBe(30);
    expect(result!.cadenceMinutes).toBe(15);
    expect(result!.reasonsForVisit).toEqual([{ value: 'cystic-acne', label: 'Cystic acne' }]);
    expect(mockSearch).toHaveBeenCalledTimes(1);
    // Search narrows to category-tagged active HSes.
    expect(mockSearch.mock.calls[0][0]).toMatchObject({
      resourceType: 'HealthcareService',
      params: expect.arrayContaining([
        expect.objectContaining({ name: '_tag', value: SERVICE_CATEGORY_TAG.code }),
        expect.objectContaining({ name: 'active', value: 'true' }),
      ]),
    });
  });

  it('returns undefined when the FHIR catalog has no entry for the code', async () => {
    mockSearch.mockResolvedValueOnce(makeBundle([]));

    const result = await resolveServiceCategory('not-in-any-catalog', mockOystehr);

    expect(result).toBeUndefined();
  });

  it('uses caller-provided fhirCategoryHits and skips the FHIR fetch', async () => {
    const adminCode = 'admin-prefetched';
    const adminHs = makeCategoryHs({
      code: adminCode,
      name: 'Prefetched',
      cadenceMinutes: 10,
    });

    const result = await resolveServiceCategory(adminCode, mockOystehr, { fhirCategoryHits: [adminHs] });

    expect(result).toBeDefined();
    expect(result!.code).toBe(adminCode);
    expect(result!.cadenceMinutes).toBe(10);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('with caller-provided fhirCategoryHits, still returns undefined when the code is absent from the prefetched list', async () => {
    const otherHs = makeCategoryHs({ code: 'something-else' });

    const result = await resolveServiceCategory('not-in-prefetched', mockOystehr, { fhirCategoryHits: [otherHs] });

    expect(result).toBeUndefined();
    expect(mockSearch).not.toHaveBeenCalled();
  });
});
