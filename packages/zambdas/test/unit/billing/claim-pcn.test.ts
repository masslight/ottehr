import { describe, expect, it } from 'vitest';
import { CLAIM_PCN_IDENTIFIER_SYSTEM, getClaimPcn } from '../../../src/billing/shared';

const CLAIM_ID = '3f2b9c1a-7d4e-4a8b-9c6d-0e1f2a3b4c5d';

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
    expect(pcn).toBeUndefined();
  });

  it('returns undefined for a claim with neither', () => {
    expect(getClaimPcn({})).toBeUndefined();
  });
});
