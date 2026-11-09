import { describe, expect, it } from 'vitest';
import { asEraClaimStatusCode, ERA_CLAIM_STATUS_CODE, normalizeNdcTo11Digits } from './billing.constants';

describe('asEraClaimStatusCode', () => {
  it('returns known CLP02 codes unchanged', () => {
    for (const code of Object.values(ERA_CLAIM_STATUS_CODE)) {
      expect(asEraClaimStatusCode(code)).toBe(code);
    }
  });

  it("returns '' for a non-conformant code", () => {
    expect(asEraClaimStatusCode('99')).toBe('');
  });

  it("returns '' for an absent value", () => {
    expect(asEraClaimStatusCode(undefined)).toBe('');
    expect(asEraClaimStatusCode('')).toBe('');
  });
});

describe('normalizeNdcTo11Digits', () => {
  it.each([
    ['0409-4888-02', '00409-4888-02'], // 4-4-2
    ['00409-488-02', '00409-0488-02'], // 5-3-2
    ['00409-4888-2', '00409-4888-02'], // 5-4-1
  ])('pads the dashed 10-digit NDC %s to %s', (ndc, expected) => {
    expect(normalizeNdcTo11Digits(ndc)).toBe(expected);
  });

  it.each(['00409-4888-02', '00409488802', '0409488802', '409-4888-02', '0409-488-02', '00409-4888-002', 'abc', ''])(
    'returns %s unchanged',
    (ndc) => {
      expect(normalizeNdcTo11Digits(ndc)).toBe(ndc);
    }
  );
});
