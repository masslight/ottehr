import { describe, expect, it } from 'vitest';
import { resolveServiceCategoryAbbreviation } from './helpers';

describe('resolveServiceCategoryAbbreviation', () => {
  const catalog = [
    { code: 'acne-facial', name: 'Acne Facial', abbreviation: 'AF' },
    { code: 'massage', name: 'Massage' }, // no explicit abbreviation
  ];

  it('prefers the admin-defined abbreviation, matched by code', () => {
    expect(resolveServiceCategoryAbbreviation('acne-facial', catalog)).toBe('AF');
  });

  it('prefers the admin-defined abbreviation, matched by display name', () => {
    expect(resolveServiceCategoryAbbreviation('Acne Facial', catalog)).toBe('AF');
  });

  it('derives an abbreviation from the catalog name when none is set', () => {
    // matched by code, derived from the catalog display name
    expect(resolveServiceCategoryAbbreviation('massage', catalog)).toBe('M');
  });

  it('falls back to deriving from the input for unknown / system categories', () => {
    // not in the FHIR catalog (e.g. compiled BOOKING_CONFIG categories)
    expect(resolveServiceCategoryAbbreviation('urgent-care')).toBe('UC');
    expect(resolveServiceCategoryAbbreviation('Workers Comp')).toBe('WC');
    expect(resolveServiceCategoryAbbreviation('pre-op')).toBe('PO');
  });

  it('returns undefined for empty / missing input', () => {
    expect(resolveServiceCategoryAbbreviation(undefined, catalog)).toBeUndefined();
    expect(resolveServiceCategoryAbbreviation('', catalog)).toBeUndefined();
    expect(resolveServiceCategoryAbbreviation('   ', catalog)).toBeUndefined();
  });

  it('ignores blank explicit abbreviations and derives instead', () => {
    const withBlank = [{ code: 'x', name: 'Example Care', abbreviation: '  ' }];
    expect(resolveServiceCategoryAbbreviation('x', withBlank)).toBe('EC');
  });
});
