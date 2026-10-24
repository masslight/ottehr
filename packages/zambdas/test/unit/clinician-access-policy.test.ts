import { describe, expect, it } from 'vitest';
import rolesSpec from '../../../../config/oystehr-core/roles.json';
import { allNonPatientRoles } from '../../src/shared/rolesUtils';

// The Clinician role has Provider-level access except the two NPI-gated capabilities enforced at the
// access-policy layer: client-side e-prescribing (eRx) and writing Claims under a provider NPI. eRx is
// narrowed rather than removed — the read-only Medispan lookups back medication search and the in-house
// medication pages, which a Clinician does use.
//
// The roles live in config/oystehr-core/roles.json (what Terraform applies); this guards that file against
// drift, since nothing derives Clinician from Provider automatically.

type Rule = { resource: string | string[]; action: string | string[] };

const policyOf = (roleKey: keyof typeof rolesSpec.roles): { rule: Rule[] } => ({
  rule: rolesSpec.roles[roleKey].accessPolicy as Rule[],
});

const CLINICIAN_RULES = policyOf('CLINICIAN');
const PROVIDER_RULES = policyOf('PROVIDER');

const grantsResource = (policy: { rule: Rule[] }, resource: string): boolean =>
  policy.rule.some((rule) => [rule.resource].flat().includes(resource));

const grantsAction = (policy: { rule: Rule[] }, resource: string, action: string): boolean =>
  policy.rule.some(
    (rule) => [rule.resource].flat().includes(resource) && [rule.action].flat().some((a) => a === action || a === '*')
  );

describe('CLINICIAN role access policy (config/oystehr-core/roles.json)', () => {
  it('sanity check: Provider grants eRx and Claim (guards against drift)', () => {
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

  // Reading a patient's outside medications is reconciliation, not prescribing — it needs no NPI and is
  // exactly the nurse/MA task the Clinician role exists for. The EHR calls it straight from the browser
  // with the user's token, so without this the chart's external-medications panel is empty.
  it('grants reading the patient external medication history', () => {
    expect(grantsAction(CLINICIAN_RULES, 'eRx:Patient', 'eRx:GetMedicationHistory')).toBe(true);
  });

  // Granting the eRx:Patient resource is only safe because the action list stays closed.
  it('does not grant the other patient-scoped eRx actions', () => {
    expect(grantsAction(CLINICIAN_RULES, 'eRx:Patient', 'eRx:SyncPatient')).toBe(false);
    expect(grantsAction(CLINICIAN_RULES, 'eRx:Patient', 'eRx:AddPatientPharmacy')).toBe(false);
  });

  it('does not grant prescribing, practitioner enrollment, interaction checks, or pharmacy access', () => {
    expect(grantsResource(CLINICIAN_RULES, 'eRx:Prescription')).toBe(false);
    expect(grantsResource(CLINICIAN_RULES, 'eRx:Practitioner')).toBe(false);
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

  // Zambda grants are generated from each zambda's `access` declaration (npm run zambda-access:generate), with
  // Clinician inheriting Staff and Provider inheriting Clinician, so no role in the chain can be missing a
  // zambda the tier below it has.
  it('can invoke every zambda Staff can, and Provider every zambda Clinician can', () => {
    const zambdaGrants = (policy: { rule: Rule[] }): string[] =>
      policy.rule
        .filter((rule) => [rule.action].flat().includes('Zambda:InvokeFunction'))
        .flatMap((rule) => [rule.resource].flat());
    const staff = zambdaGrants(policyOf('STAFF'));
    const clinician = zambdaGrants(CLINICIAN_RULES);
    const provider = zambdaGrants(PROVIDER_RULES);
    expect(staff.length).toBeGreaterThan(0);
    expect(staff.some((grant) => grant.endsWith(':*'))).toBe(false);
    expect(clinician).toEqual(expect.arrayContaining(staff));
    expect(provider).toEqual(expect.arrayContaining(clinician));
  });
});

describe('allNonPatientRoles', () => {
  it('mirrors roles.json so the role scripts can never push a policy that differs from the IaC config', () => {
    const names = allNonPatientRoles.map((role) => role.name).sort();
    const expected = Object.entries(rolesSpec.roles)
      .filter(([key]) => key !== 'PATIENT')
      .map(([, role]) => role.name)
      .sort();
    expect(names).toEqual(expected);
    const clinician = allNonPatientRoles.find((role) => role.name === 'Clinician');
    expect(clinician?.accessPolicy.rule).toEqual(rolesSpec.roles.CLINICIAN.accessPolicy);
  });
});
