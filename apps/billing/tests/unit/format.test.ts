import { ServiceFacilityItem } from 'utils';
import { describe, expect, it } from 'vitest';
import { buildAddressInput, formatDateTime, formatFacilityAddress, splitDisplayName } from '../../src/utils/format';

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

describe('formatDateTime', () => {
  it('renders an ISO timestamp as a localized date and time', () => {
    const formatted = formatDateTime('2026-06-01T12:00:00Z');
    expect(formatted).not.toBe('2026-06-01T12:00:00Z');
    expect(formatted).toContain('2026');
  });

  it('returns a dash for an empty value', () => {
    expect(formatDateTime('')).toBe('-');
  });

  it("passes a value that can't be parsed straight through", () => {
    expect(formatDateTime('not a date')).toBe('not a date');
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
