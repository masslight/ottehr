import { type ServiceCategoryConfig } from 'config-types';
import { describe, expect, it } from 'vitest';
import { SERVICE_CATEGORY_SYSTEM } from '../fhir';
import { resolveReasonForVisitOptions } from './booking';

const makeCategory = (code: string, overrides: Partial<ServiceCategoryConfig> = {}): ServiceCategoryConfig => ({
  category: { code, display: code, system: SERVICE_CATEGORY_SYSTEM },
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
