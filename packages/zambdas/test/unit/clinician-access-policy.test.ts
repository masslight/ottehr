import { describe, expect, it } from 'vitest';
import { CLINICIAN_RULES, PROVIDER_RULES } from '../../src/shared/accessPolicies';

// The Clinician role has Provider-level access except the two NPI-gated capabilities enforced at the
// access-policy layer: client-side e-prescribing (eRx) and writing Claims under a provider NPI.

const grantsResource = (policy: { rule: { resource: string | string[] }[] }, resource: string): boolean =>
  policy.rule.some((rule) => [rule.resource].flat().includes(resource));

describe('CLINICIAN_RULES', () => {
  it('sanity check: PROVIDER_RULES grants eRx and Claim (guards against drift)', () => {
    expect(grantsResource(PROVIDER_RULES, 'eRx:*')).toBe(true);
    expect(grantsResource(PROVIDER_RULES, 'FHIR:Claim')).toBe(true);
  });

  it('does not grant e-prescribing', () => {
    expect(grantsResource(CLINICIAN_RULES, 'eRx:*')).toBe(false);
  });

  it('does not grant Claim access', () => {
    expect(grantsResource(CLINICIAN_RULES, 'FHIR:Claim')).toBe(false);
  });

  it('keeps the rest of Provider access (e.g. Appointment and Patient)', () => {
    expect(grantsResource(CLINICIAN_RULES, 'FHIR:Appointment')).toBe(true);
    expect(grantsResource(CLINICIAN_RULES, 'FHIR:Patient')).toBe(true);
    // The RCM block (minus Claim) is retained, so Coverage from that block survives.
    expect(grantsResource(CLINICIAN_RULES, 'FHIR:Coverage')).toBe(true);
  });
});
