import { describe, expect, it } from 'vitest';
import { procedureFormResolver } from './procedureFormValidation';

describe('procedure form validation', () => {
  it.each([undefined, ''])('requires a procedure type (%s)', async (procedureType) => {
    const result = await procedureFormResolver({ procedureType }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(result.values).toEqual({});
    expect(result.errors).toEqual({ procedureType: { type: 'required', message: 'This field is required' } });
  });
  it.each([' Laceration', 'Laceration ', 'Laceration  Repair', '   '])(
    'rejects invalid spacing in %s',
    async (procedureType) => {
      const result = await procedureFormResolver({ procedureType }, undefined, {
        fields: {},
        shouldUseNativeValidation: false,
      });
      expect(result.values).toEqual({});
      expect(result.errors).toEqual({
        procedureType: { type: 'validate', message: 'No leading, trailing, or consecutive spaces allowed' },
      });
    }
  );
  it.each(['Laceration Repair', 'EKG', '123'])('accepts %s without rewriting it', async (procedureType) => {
    const values = { procedureType };
    const result = await procedureFormResolver(values, undefined, { fields: {}, shouldUseNativeValidation: false });
    expect(result.values).toEqual(values);
    expect(result.errors).toEqual({});
  });
});
