import { describe, expect, it } from 'vitest';
import { validateServiceFacilityFields } from '../../src/utils/validation';

describe('validateServiceFacilityFields', () => {
  const valid = {
    npi: '',
    clia: '',
    zip: '021181234',
  };

  it('accepts a 9-digit ZIP', () => {
    expect(validateServiceFacilityFields(valid)).toBeNull();
  });

  it('rejects a 5-digit ZIP', () => {
    expect(validateServiceFacilityFields({ ...valid, zip: '02118' })).toMatch(/ZIP/);
  });

  it('rejects a ZIP that contains non-digits', () => {
    expect(validateServiceFacilityFields({ ...valid, zip: '02118-123' })).toMatch(/ZIP/);
  });

  it('rejects an NPI with a bad check digit', () => {
    expect(validateServiceFacilityFields({ ...valid, npi: '1234567890' })).toMatch(/NPI/);
  });
});
