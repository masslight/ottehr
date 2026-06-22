import { type ServiceCategoryConfig } from 'config-types';
import { describe, expect, it } from 'vitest';
import { SERVICE_CATEGORY_SYSTEM } from '../fhir';
import { resolveReasonForVisitOptions, serviceCategorySupportsContext } from './booking';

const makeCategory = (code: string, overrides: Partial<ServiceCategoryConfig> = {}): ServiceCategoryConfig => ({
  category: { code, display: code, system: SERVICE_CATEGORY_SYSTEM },
  serviceModes: ['in-person', 'virtual'],
  visitTypes: ['prebook', 'walk-in'],
  reasonsForVisit: { default: [] },
  ...overrides,
});

const categories: ServiceCategoryConfig[] = [
  makeCategory('urgent-care', {
    reasonsForVisit: {
      'in-person': [
        { label: 'Fever', value: 'Fever' },
        { label: 'Cough', value: 'Cough' },
      ],
      virtual: [{ label: 'Rash', value: 'Rash' }],
    },
  }),
  makeCategory('workers-comp', {
    serviceModes: ['in-person'],
    reasonsForVisit: {
      default: [{ label: 'Injury', value: 'Injury' }],
    },
  }),
  makeCategory('aesthetics', {
    serviceModes: ['in-person'],
    reasonsForVisit: {
      default: [
        { label: 'Botox', value: 'Botox' },
        { label: 'Filler', value: 'Filler' },
      ],
    },
  }),
  makeCategory('no-rfv'), // category without reasonsForVisit
];

describe('resolveReasonForVisitOptions', () => {
  it('returns empty array for category without reasonsForVisit', () => {
    const result = resolveReasonForVisitOptions(categories, 'no-rfv');
    expect(result).toEqual([]);
  });

  it('returns empty array for unknown category', () => {
    const result = resolveReasonForVisitOptions(categories, 'nonexistent');
    expect(result).toEqual([]);
  });

  it('returns mode-specific options when serviceMode matches', () => {
    const result = resolveReasonForVisitOptions(categories, 'urgent-care', 'in-person');
    expect(result).toEqual([
      { label: 'Fever', value: 'Fever' },
      { label: 'Cough', value: 'Cough' },
    ]);
  });

  it('returns different options for different modes', () => {
    const virtual = resolveReasonForVisitOptions(categories, 'urgent-care', 'virtual');
    expect(virtual).toEqual([{ label: 'Rash', value: 'Rash' }]);
  });

  it('falls back to default when mode-specific entry does not exist', () => {
    // workers-comp only has default, request virtual mode
    const result = resolveReasonForVisitOptions(categories, 'workers-comp', 'virtual');
    expect(result).toEqual([{ label: 'Injury', value: 'Injury' }]);
  });

  it('returns default options when no serviceMode specified', () => {
    const result = resolveReasonForVisitOptions(categories, 'aesthetics');
    expect(result).toEqual([
      { label: 'Botox', value: 'Botox' },
      { label: 'Filler', value: 'Filler' },
    ]);
  });

  it('combines all mode-specific lists when no default and no serviceMode specified', () => {
    // urgent-care has in-person and virtual but no default
    const result = resolveReasonForVisitOptions(categories, 'urgent-care');
    const values = result.map((o) => o.value);
    expect(values).toEqual(['Fever', 'Cough', 'Rash']);
  });

  it('deduplicates when combining mode-specific lists', () => {
    const cats = [
      makeCategory('test', {
        reasonsForVisit: {
          'in-person': [
            { label: 'Fever', value: 'Fever' },
            { label: 'Cough', value: 'Cough' },
          ],
          virtual: [
            { label: 'Fever', value: 'Fever' }, // duplicate
            { label: 'Rash', value: 'Rash' },
          ],
        },
      }),
    ];
    const result = resolveReasonForVisitOptions(cats, 'test');
    const values = result.map((o) => o.value);
    expect(values).toEqual(['Fever', 'Cough', 'Rash']);
  });

  it('returns a copy, not a reference to the config array', () => {
    const result1 = resolveReasonForVisitOptions(categories, 'aesthetics');
    const result2 = resolveReasonForVisitOptions(categories, 'aesthetics');
    expect(result1).toEqual(result2);
    expect(result1).not.toBe(result2);
  });
});

describe('serviceCategorySupportsContext', () => {
  // Two source labels, three array states each = enough fixtures to exercise
  // the rule combinations the helper has to distinguish (booking-config-vs-
  // fhir crossed with tagged/untagged/wrongly-tagged).
  const bookingConfigEmpty = (): ServiceCategoryConfig & { source: 'booking-config' } => ({
    ...makeCategory('legacy-untagged', { serviceModes: [], visitTypes: [] }),
    source: 'booking-config',
  });
  const bookingConfigTagged = (): ServiceCategoryConfig & { source: 'booking-config' } => ({
    ...makeCategory('walkin-only', { serviceModes: ['in-person'], visitTypes: ['walk-in'] }),
    source: 'booking-config',
  });
  const fhirEmpty = (): ServiceCategoryConfig & { source: 'fhir' } => ({
    ...makeCategory('misconfigured-fhir', { serviceModes: [], visitTypes: [] }),
    source: 'fhir',
  });
  const fhirTagged = (): ServiceCategoryConfig & { source: 'fhir' } => ({
    ...makeCategory('virtual-prebook', { serviceModes: ['virtual'], visitTypes: ['prebook'] }),
    source: 'fhir',
  });

  describe('BOOKING_CONFIG with empty tags — legacy "supports all" contract', () => {
    it('supports any (mode, type) — the pre-tagging compiled-in behavior', () => {
      expect(serviceCategorySupportsContext(bookingConfigEmpty(), 'in-person', 'walk-in')).toBe(true);
      expect(serviceCategorySupportsContext(bookingConfigEmpty(), 'virtual', 'prebook')).toBe(true);
    });

    it('supports any single-dimension query (the other dimension undefined)', () => {
      expect(serviceCategorySupportsContext(bookingConfigEmpty(), undefined, 'walk-in')).toBe(true);
      expect(serviceCategorySupportsContext(bookingConfigEmpty(), 'virtual', undefined)).toBe(true);
    });

    it('supports the no-filter query (both undefined)', () => {
      expect(serviceCategorySupportsContext(bookingConfigEmpty(), undefined, undefined)).toBe(true);
    });
  });

  describe('BOOKING_CONFIG with explicit tags — honors the configured restrictions', () => {
    it('matches when both dimensions are in the configured sets', () => {
      expect(serviceCategorySupportsContext(bookingConfigTagged(), 'in-person', 'walk-in')).toBe(true);
    });

    it('excludes when either dimension is outside the configured set', () => {
      expect(serviceCategorySupportsContext(bookingConfigTagged(), 'virtual', 'walk-in')).toBe(false);
      expect(serviceCategorySupportsContext(bookingConfigTagged(), 'in-person', 'prebook')).toBe(false);
    });

    it('matches a single-dimension query when the other is undefined', () => {
      expect(serviceCategorySupportsContext(bookingConfigTagged(), undefined, 'walk-in')).toBe(true);
      expect(serviceCategorySupportsContext(bookingConfigTagged(), 'in-person', undefined)).toBe(true);
    });

    it('excludes a single-dimension query when the specified dimension is wrong', () => {
      expect(serviceCategorySupportsContext(bookingConfigTagged(), undefined, 'prebook')).toBe(false);
      expect(serviceCategorySupportsContext(bookingConfigTagged(), 'virtual', undefined)).toBe(false);
    });
  });

  describe('FHIR with explicit tags — same restrictions as BOOKING_CONFIG when tagged', () => {
    it('matches when both dimensions are in the configured sets', () => {
      expect(serviceCategorySupportsContext(fhirTagged(), 'virtual', 'prebook')).toBe(true);
    });

    it('excludes when either dimension is outside the configured set', () => {
      expect(serviceCategorySupportsContext(fhirTagged(), 'in-person', 'prebook')).toBe(false);
      expect(serviceCategorySupportsContext(fhirTagged(), 'virtual', 'walk-in')).toBe(false);
    });

    it('matches a single-dimension query when the other is undefined', () => {
      expect(serviceCategorySupportsContext(fhirTagged(), undefined, 'prebook')).toBe(true);
      expect(serviceCategorySupportsContext(fhirTagged(), 'virtual', undefined)).toBe(true);
    });
  });

  describe('FHIR with empty tags — treated as misconfigured, never surfaced', () => {
    it('does NOT support any specified context', () => {
      expect(serviceCategorySupportsContext(fhirEmpty(), 'in-person', 'walk-in')).toBe(false);
      expect(serviceCategorySupportsContext(fhirEmpty(), 'virtual', 'prebook')).toBe(false);
    });

    it('does NOT support a single-dimension query — even on the skipped dimension', () => {
      // This is the edge case the PR review fix locked in. Previously a
      // skipped dimension returned true regardless of source/emptiness, so
      // an empty-arrays FHIR entry slipped through the picker (which calls
      // with serviceMode=undefined). Patient could pick a category that
      // would then fail at booking time. Now the FHIR + empty + skipped
      // case is excluded along with the FHIR + empty + specified case.
      expect(serviceCategorySupportsContext(fhirEmpty(), undefined, 'walk-in')).toBe(false);
      expect(serviceCategorySupportsContext(fhirEmpty(), 'in-person', undefined)).toBe(false);
      expect(serviceCategorySupportsContext(fhirEmpty(), undefined, undefined)).toBe(false);
    });
  });

  describe('untagged source — defaults to FHIR-style strictness', () => {
    // An entry without an explicit source label is treated as FHIR (the
    // conservative default). This matters for callers that haven't been
    // updated to thread the source through — they get the stricter rule
    // automatically, which fails loudly rather than silently surfacing
    // misconfigured entries.
    it('with empty tags, excludes everywhere (mirrors FHIR-empty behavior)', () => {
      const untagged = makeCategory('no-source', { serviceModes: [], visitTypes: [] });
      expect(serviceCategorySupportsContext(untagged, 'in-person', 'walk-in')).toBe(false);
      expect(serviceCategorySupportsContext(untagged, undefined, 'walk-in')).toBe(false);
      expect(serviceCategorySupportsContext(untagged, undefined, undefined)).toBe(false);
    });

    it('with explicit tags, honors the configured restrictions', () => {
      const untagged = makeCategory('no-source-tagged', { serviceModes: ['in-person'], visitTypes: ['prebook'] });
      expect(serviceCategorySupportsContext(untagged, 'in-person', 'prebook')).toBe(true);
      expect(serviceCategorySupportsContext(untagged, 'virtual', 'prebook')).toBe(false);
    });
  });

  describe('regression coverage — both dimensions enforced as AND', () => {
    it('requires both dimensions to support; one mismatch fails the whole check', () => {
      const sc: ServiceCategoryConfig & { source: 'fhir' } = {
        ...makeCategory('partial-match', { serviceModes: ['in-person', 'virtual'], visitTypes: ['walk-in'] }),
        source: 'fhir',
      };
      expect(serviceCategorySupportsContext(sc, 'in-person', 'walk-in')).toBe(true);
      // serviceMode matches, visitType doesn't — must NOT pass.
      expect(serviceCategorySupportsContext(sc, 'in-person', 'prebook')).toBe(false);
      // visitType matches, serviceMode doesn't — must NOT pass.
      const sc2: ServiceCategoryConfig & { source: 'fhir' } = {
        ...makeCategory('partial-match-2', { serviceModes: ['in-person'], visitTypes: ['walk-in', 'prebook'] }),
        source: 'fhir',
      };
      expect(serviceCategorySupportsContext(sc2, 'virtual', 'prebook')).toBe(false);
    });
  });
});
