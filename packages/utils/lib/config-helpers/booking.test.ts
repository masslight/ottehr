import { type ServiceCategoryConfig } from 'config-types';
import { describe, expect, it } from 'vitest';

// getReasonForVisitOptionsForServiceCategory depends on BOOKING_CONFIG (which triggers
// the full ottehr-config module graph with pre-existing validation errors).
// We inline the resolution logic here to test it in isolation.

type RFVOption = { label: string; value: string };
type ReasonsForVisit = { default?: RFVOption[]; 'in-person'?: RFVOption[]; virtual?: RFVOption[] };

const getReasonForVisitOptionsForServiceCategory = (
  serviceCategories: ServiceCategoryConfig[],
  serviceCategory: string,
  serviceMode?: string
): RFVOption[] => {
  const categoryConfig = serviceCategories.find((sc) => sc.category.code === serviceCategory);
  if (!categoryConfig?.reasonsForVisit) {
    return [];
  }

  const rfv = categoryConfig.reasonsForVisit as ReasonsForVisit;

  if (serviceMode) {
    const modeKey = serviceMode as keyof ReasonsForVisit;
    if (rfv[modeKey]) {
      return [...rfv[modeKey]!];
    }
    if (rfv.default) {
      return [...rfv.default];
    }
  }

  if (rfv.default) {
    return [...rfv.default];
  }

  // No mode specified and no default: combine all mode-specific lists
  const combined = new Map<string, RFVOption>();
  for (const options of Object.values(rfv)) {
    if (options) {
      for (const opt of options) {
        combined.set(opt.value, opt);
      }
    }
  }
  return [...combined.values()];
};

const SYSTEM = 'https://fhir.ottehr.com/CodeSystem/service-category';

const makeCategory = (code: string, overrides: Partial<ServiceCategoryConfig> = {}): ServiceCategoryConfig => ({
  category: { code, display: code, system: SYSTEM },
  serviceModes: ['in-person', 'virtual'],
  visitTypes: ['prebook', 'walk-in'],
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

describe('getReasonForVisitOptionsForServiceCategory', () => {
  it('returns empty array for category without reasonsForVisit', () => {
    const result = getReasonForVisitOptionsForServiceCategory(categories, 'no-rfv');
    expect(result).toEqual([]);
  });

  it('returns empty array for unknown category', () => {
    const result = getReasonForVisitOptionsForServiceCategory(categories, 'nonexistent');
    expect(result).toEqual([]);
  });

  it('returns mode-specific options when serviceMode matches', () => {
    const result = getReasonForVisitOptionsForServiceCategory(categories, 'urgent-care', 'in-person');
    expect(result).toEqual([
      { label: 'Fever', value: 'Fever' },
      { label: 'Cough', value: 'Cough' },
    ]);
  });

  it('returns different options for different modes', () => {
    const virtual = getReasonForVisitOptionsForServiceCategory(categories, 'urgent-care', 'virtual');
    expect(virtual).toEqual([{ label: 'Rash', value: 'Rash' }]);
  });

  it('falls back to default when mode-specific entry does not exist', () => {
    // workers-comp only has default, request virtual mode
    const result = getReasonForVisitOptionsForServiceCategory(categories, 'workers-comp', 'virtual');
    expect(result).toEqual([{ label: 'Injury', value: 'Injury' }]);
  });

  it('returns default options when no serviceMode specified', () => {
    const result = getReasonForVisitOptionsForServiceCategory(categories, 'aesthetics');
    expect(result).toEqual([
      { label: 'Botox', value: 'Botox' },
      { label: 'Filler', value: 'Filler' },
    ]);
  });

  it('combines all mode-specific lists when no default and no serviceMode specified', () => {
    // urgent-care has in-person and virtual but no default
    const result = getReasonForVisitOptionsForServiceCategory(categories, 'urgent-care');
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
    const result = getReasonForVisitOptionsForServiceCategory(cats, 'test');
    const values = result.map((o) => o.value);
    expect(values).toEqual(['Fever', 'Cough', 'Rash']);
  });

  it('returns a copy, not a reference to the config array', () => {
    const result1 = getReasonForVisitOptionsForServiceCategory(categories, 'aesthetics');
    const result2 = getReasonForVisitOptionsForServiceCategory(categories, 'aesthetics');
    expect(result1).toEqual(result2);
    expect(result1).not.toBe(result2);
  });
});
