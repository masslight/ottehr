import { HealthcareService } from 'fhir/r4b';
import { SERVICE_CATEGORIES_AVAILABLE } from 'utils';
import { describe, expect, it } from 'vitest';
import {
  SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
} from '../../src/ehr/admin-service-categories/helpers';
import {
  buildCatalog,
  filterByOfferedCodes,
  getGroupOfferedCodes,
} from '../../src/patient/booking/get-service-categories/helpers';

// ── Fixture builders ─────────────────────────────────────────────────────────

const BOOKING_CONFIG_CODES = SERVICE_CATEGORIES_AVAILABLE.map((sc) => sc.category.code!).filter(Boolean);

const makeFhirCategory = (code: string, name: string, durationMinutes = 30): HealthcareService => ({
  resourceType: 'HealthcareService',
  id: `hs-${code}`,
  active: true,
  name,
  meta: { tag: [SERVICE_CATEGORY_TAG] },
  type: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code, display: name }] }],
  extension: [
    {
      url: SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
      valueString: JSON.stringify({
        durationMinutes,
        serviceModes: ['in-person'],
        visitTypes: ['prebook'],
      }),
    },
  ],
});

const makeGroup = (codes: string[] = [], opts: { codingSystem?: string } = {}): HealthcareService => ({
  resourceType: 'HealthcareService',
  id: 'group-1',
  active: true,
  name: 'Test Group',
  type: codes.map((code) => ({
    coding: [{ system: opts.codingSystem ?? SERVICE_CATEGORY_SYSTEM, code }],
  })),
});

// ── buildCatalog tests ───────────────────────────────────────────────────────

describe('buildCatalog', () => {
  it('returns all BOOKING_CONFIG entries when FHIR is empty, each tagged source: booking-config', () => {
    const result = buildCatalog([]);
    expect(result.length).toBe(BOOKING_CONFIG_CODES.length);
    for (const r of result) {
      expect(r.source).toBe('booking-config');
      expect(BOOKING_CONFIG_CODES).toContain(r.code);
    }
  });

  it('appends FHIR entries whose codes are not in BOOKING_CONFIG, tagged source: fhir', () => {
    const fhir = [makeFhirCategory('botox', 'Botox')];
    const result = buildCatalog(fhir);
    const botox = result.find((r) => r.code === 'botox');
    expect(botox).toBeDefined();
    expect(botox?.source).toBe('fhir');
    expect(botox?.name).toBe('Botox');
  });

  it('drops FHIR entries whose codes collide with BOOKING_CONFIG (D14 precedence)', () => {
    const collidingCode = BOOKING_CONFIG_CODES[0];
    const fhir = [makeFhirCategory(collidingCode, `Hijacked ${collidingCode}`, 99)];
    const result = buildCatalog(fhir);
    const matches = result.filter((r) => r.code === collidingCode);
    expect(matches.length).toBe(1);
    expect(matches[0].source).toBe('booking-config');
    expect(matches[0].name).not.toBe(`Hijacked ${collidingCode}`);
    expect(matches[0].config.durationMinutes).not.toBe(99);
  });

  it('returns booking-config entries even when every FHIR record collides', () => {
    const fhir = BOOKING_CONFIG_CODES.map((code) => makeFhirCategory(code, `Hijacked ${code}`));
    const result = buildCatalog(fhir);
    expect(result.length).toBe(BOOKING_CONFIG_CODES.length);
    for (const r of result) expect(r.source).toBe('booking-config');
  });

  it('handles partial collisions: BOOKING_CONFIG wins on overlap, non-colliding FHIR appended', () => {
    const collidingCode = BOOKING_CONFIG_CODES[0];
    const fhir = [
      makeFhirCategory(collidingCode, `Hijacked ${collidingCode}`),
      makeFhirCategory('botox', 'Botox'),
      makeFhirCategory('acne', 'Acne'),
    ];
    const result = buildCatalog(fhir);
    expect(result.find((r) => r.code === collidingCode)?.source).toBe('booking-config');
    expect(result.find((r) => r.code === 'botox')?.source).toBe('fhir');
    expect(result.find((r) => r.code === 'acne')?.source).toBe('fhir');
    expect(result.length).toBe(BOOKING_CONFIG_CODES.length + 2);
  });

  it('drops FHIR records that resolve to empty code', () => {
    const emptyResource: HealthcareService = {
      resourceType: 'HealthcareService',
      id: 'empty',
      active: true,
      meta: { tag: [SERVICE_CATEGORY_TAG] },
    };
    const result = buildCatalog([emptyResource]);
    expect(result.length).toBe(BOOKING_CONFIG_CODES.length);
    expect(result.find((r) => r.code === '')).toBeUndefined();
  });

  it('places all BOOKING_CONFIG entries before FHIR-only entries in the returned order', () => {
    const fhir = [makeFhirCategory('botox', 'Botox')];
    const result = buildCatalog(fhir);
    const firstFhirIndex = result.findIndex((r) => r.source === 'fhir');
    expect(firstFhirIndex).toBeGreaterThan(0);
    for (let i = 0; i < firstFhirIndex; i++) {
      expect(result[i].source).toBe('booking-config');
    }
  });
});

// ── getGroupOfferedCodes tests ───────────────────────────────────────────────

describe('getGroupOfferedCodes', () => {
  it('returns empty set when group has no type[]', () => {
    expect(getGroupOfferedCodes(makeGroup()).size).toBe(0);
  });

  it('returns empty set when type[] entries have no codings', () => {
    const group: HealthcareService = {
      resourceType: 'HealthcareService',
      id: 'g',
      type: [{ coding: [] }, {}],
    };
    expect(getGroupOfferedCodes(group).size).toBe(0);
  });

  it('returns codes whose system matches SERVICE_CATEGORY_SYSTEM', () => {
    const result = getGroupOfferedCodes(makeGroup(['botox', 'acne']));
    expect(result.has('botox')).toBe(true);
    expect(result.has('acne')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('ignores codings under a different system', () => {
    const result = getGroupOfferedCodes(makeGroup(['botox'], { codingSystem: 'http://other.system/codes' }));
    expect(result.size).toBe(0);
  });

  it('mixes: only codings under SERVICE_CATEGORY_SYSTEM are included', () => {
    const group: HealthcareService = {
      resourceType: 'HealthcareService',
      id: 'g',
      type: [
        { coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: 'botox' }] },
        { coding: [{ system: 'http://other.system/codes', code: 'mri' }] },
      ],
    };
    const result = getGroupOfferedCodes(group);
    expect(result.has('botox')).toBe(true);
    expect(result.has('mri')).toBe(false);
  });

  it('ignores codings under SERVICE_CATEGORY_SYSTEM that have no code', () => {
    const group: HealthcareService = {
      resourceType: 'HealthcareService',
      id: 'g',
      type: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM }] }],
    };
    expect(getGroupOfferedCodes(group).size).toBe(0);
  });
});

// ── filterByOfferedCodes tests ───────────────────────────────────────────────

describe('filterByOfferedCodes', () => {
  it('returns the full catalog when offeredCodes is empty (admin grace period)', () => {
    const catalog = buildCatalog([]);
    expect(filterByOfferedCodes(catalog, new Set())).toEqual(catalog);
  });

  it('filters catalog to entries whose code is in offeredCodes', () => {
    const catalog = buildCatalog([makeFhirCategory('botox', 'Botox')]);
    const targetCode = BOOKING_CONFIG_CODES[0];
    const result = filterByOfferedCodes(catalog, new Set([targetCode, 'botox']));
    expect(result.map((r) => r.code).sort()).toEqual([targetCode, 'botox'].sort());
  });

  it('silently drops offeredCodes that are not present in the catalog', () => {
    const catalog = buildCatalog([]);
    const targetCode = BOOKING_CONFIG_CODES[0];
    const result = filterByOfferedCodes(catalog, new Set([targetCode, 'no-such-code']));
    expect(result.map((r) => r.code)).toEqual([targetCode]);
  });

  it('returns an empty array when no offeredCode overlaps with the catalog', () => {
    const catalog = buildCatalog([]);
    expect(filterByOfferedCodes(catalog, new Set(['nonexistent-code']))).toEqual([]);
  });

  it('preserves the source tag on filtered entries', () => {
    const catalog = buildCatalog([makeFhirCategory('botox', 'Botox')]);
    const targetCode = BOOKING_CONFIG_CODES[0];
    const result = filterByOfferedCodes(catalog, new Set([targetCode, 'botox']));
    expect(result.find((r) => r.code === targetCode)?.source).toBe('booking-config');
    expect(result.find((r) => r.code === 'botox')?.source).toBe('fhir');
  });
});
