import { ServiceFacilityItem } from 'utils';
import { describe, expect, it } from 'vitest';
import { buildAddressInput, formatCurrency, formatFacilityAddress, splitDisplayName } from '../../src/utils/format';

describe('formatCurrency', () => {
  it('formats whole and fractional amounts to two decimals', () => {
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(12)).toBe('$12.00');
    expect(formatCurrency(12.5)).toBe('$12.50');
    expect(formatCurrency(12.345)).toBe('$12.35');
  });
});

describe('splitDisplayName', () => {
  it('splits a "Last, First" display name', () => {
    expect(splitDisplayName('Doe, Jane')).toEqual({ firstName: 'Jane', lastName: 'Doe' });
  });

  it('treats a name without a comma as the last name only', () => {
    expect(splitDisplayName('Doe')).toEqual({ firstName: '', lastName: 'Doe' });
  });

  it('returns empty parts for an empty string', () => {
    expect(splitDisplayName('')).toEqual({ firstName: '', lastName: '' });
  });
});

describe('buildAddressInput', () => {
  it('returns undefined when every field is blank or whitespace', () => {
    expect(buildAddressInput('', '', '', '', '')).toBeUndefined();
    expect(buildAddressInput('  ', '', ' ', '', '  ')).toBeUndefined();
  });

  it('includes only populated, trimmed fields and maps zip to postalCode', () => {
    expect(buildAddressInput(' 1 Main St ', '', 'Austin', 'TX', '78701')).toEqual({
      line1: '1 Main St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
    });
  });
});

describe('formatFacilityAddress', () => {
  const base: ServiceFacilityItem = {
    id: 'loc-1',
    name: 'Main Street Clinic',
    addressLine1: '123 Main St',
    addressLine2: '',
    city: 'Boston',
    state: 'MA',
    zip: '',
    npi: '',
    clia: '',
    posCode: '',
    status: 'active',
  };

  it('hyphenates a stored 9-digit ZIP', () => {
    expect(formatFacilityAddress({ ...base, zip: '021181234' })).toBe('123 Main St, Boston, MA, 02118-1234');
  });

  it('leaves a legacy 5-digit ZIP unchanged', () => {
    expect(formatFacilityAddress({ ...base, zip: '02118' })).toBe('123 Main St, Boston, MA, 02118');
  });

  it('drops blank parts', () => {
    expect(
      formatFacilityAddress({
        ...base,
        addressLine1: '',
        city: '',
        state: '',
        zip: '',
      })
    ).toBe('');
  });
});
