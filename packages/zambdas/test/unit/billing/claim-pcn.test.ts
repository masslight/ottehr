import { describe, expect, it } from 'vitest';
import { CLAIM_PCN_IDENTIFIER_SYSTEM, claimIdFromPcn, getClaimPcn } from '../../../src/billing/shared';

const CLAIM_ID = '3f2b9c1a-7d4e-4a8b-9c6d-0e1f2a3b4c5d';
const MINIFIED_CLAIM_ID = '3f2b9c1a7d4e4a8b9c6d0e1f2a3b4c5d';

describe('getClaimPcn', () => {
  it('prefers the patient control number identifier when one is present', () => {
    const pcn = getClaimPcn({
      id: CLAIM_ID,
      identifier: [
        {
          system: CLAIM_PCN_IDENTIFIER_SYSTEM,
          value: 'CUSTOM-PCN-1',
        },
      ],
    });
    expect(pcn).toBe('CUSTOM-PCN-1');
  });

  it('falls back to the claim id with dashes stripped', () => {
    expect(getClaimPcn({ id: CLAIM_ID })).toBe(MINIFIED_CLAIM_ID);
  });

  it('ignores identifiers in other systems', () => {
    const pcn = getClaimPcn({
      id: CLAIM_ID,
      identifier: [
        {
          system: 'https://identifiers.fhir.oystehr.com/era-check-number',
          value: 'CHECK-9',
        },
      ],
    });
    expect(pcn).toBe(MINIFIED_CLAIM_ID);
  });

  it('returns an empty string for a claim with neither', () => {
    expect(getClaimPcn({})).toBe('');
  });
});

describe('claimIdFromPcn', () => {
  it('round-trips a dash-stripped claim id back into its claim id', () => {
    expect(claimIdFromPcn(MINIFIED_CLAIM_ID)).toBe(CLAIM_ID);
    expect(claimIdFromPcn(getClaimPcn({ id: CLAIM_ID }))).toBe(CLAIM_ID);
  });

  it('accepts a capitalized PCN, since resource ids are lowercase', () => {
    expect(claimIdFromPcn(MINIFIED_CLAIM_ID.toUpperCase())).toBe(CLAIM_ID);
  });

  it('returns undefined for a PCN that is not a dash-stripped uuid', () => {
    expect(claimIdFromPcn('Smith')).toBeUndefined();
    expect(claimIdFromPcn('CUSTOM-PCN-1')).toBeUndefined();
    expect(claimIdFromPcn(CLAIM_ID)).toBeUndefined();
    expect(claimIdFromPcn('')).toBeUndefined();
  });

  it('returns undefined for 32 characters that are not hex', () => {
    expect(claimIdFromPcn('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBeUndefined();
  });

  it('returns undefined when the restored id is not a valid uuid', () => {
    expect(claimIdFromPcn('3f2b9c1a7d4e9a8b9c6d0e1f2a3b4c5d')).toBeUndefined();
  });
});
