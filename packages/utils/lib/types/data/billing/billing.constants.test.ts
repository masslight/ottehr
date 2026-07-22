import { describe, expect, it } from 'vitest';
import { asEraClaimStatusCode, ERA_CLAIM_STATUS_CODE } from './billing.constants';

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
