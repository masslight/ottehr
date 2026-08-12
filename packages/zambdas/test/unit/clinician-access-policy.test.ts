import { describe, expect, it } from 'vitest';
import { CLINICIAN_RULES, PROVIDER_RULES } from '../../src/shared/accessPolicies';

// The Clinician role has Provider-level access except the two NPI-gated capabilities enforced at the
// access-policy layer: client-side e-prescribing (eRx) and writing Claims under a provider NPI. eRx is
// narrowed rather than removed — the read-only Medispan lookups back medication search and the in-house
// medication pages, which a Clinician does use.

type Rule = { resource: string | string[]; action: string | string[] };

const grantsResource = (policy: { rule: Rule[] }, resource: string): boolean =>
  policy.rule.some((rule) => [rule.resource].flat().includes(resource));

const grantsAction = (policy: { rule: Rule[] }, resource: string, action: string): boolean =>
  policy.rule.some(
    (rule) => [rule.resource].flat().includes(resource) && [rule.action].flat().some((a) => a === action || a === '*')
  );

describe('CLINICIAN_RULES', () => {
  it('sanity check: PROVIDER_RULES grants eRx and Claim (guards against drift)', () => {
    expect(grantsResource(PROVIDER_RULES, 'eRx:*')).toBe(true);
    expect(grantsResource(PROVIDER_RULES, 'FHIR:Claim')).toBe(true);
  });

  it('does not grant blanket eRx access', () => {
    expect(grantsResource(CLINICIAN_RULES, 'eRx:*')).toBe(false);
  });

  it('grants the read-only eRx reference lookups', () => {
    expect(grantsAction(CLINICIAN_RULES, 'eRx:Medication', 'eRx:SearchMedication')).toBe(true);
    expect(grantsAction(CLINICIAN_RULES, 'eRx:Medication', 'eRx:GetMedication')).toBe(true);
    expect(grantsAction(CLINICIAN_RULES, 'eRx:Allergen', 'eRx:SearchAllergen')).toBe(true);
    expect(grantsAction(CLINICIAN_RULES, 'eRx:Configuration', 'eRx:GetConfiguration')).toBe(true);
  });

  it('does not grant prescribing, practitioner enrollment, or patient-scoped eRx actions', () => {
    expect(grantsResource(CLINICIAN_RULES, 'eRx:Prescription')).toBe(false);
    expect(grantsResource(CLINICIAN_RULES, 'eRx:Practitioner')).toBe(false);
    expect(grantsResource(CLINICIAN_RULES, 'eRx:Patient')).toBe(false);
    expect(grantsResource(CLINICIAN_RULES, 'eRx:Interaction')).toBe(false);
    expect(grantsResource(CLINICIAN_RULES, 'eRx:Pharmacy')).toBe(false);
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
