import Oystehr from '@oystehr/sdk';
import { Account, Claim, Coverage, RelatedPerson } from 'fhir/r4b';
import { ACCOUNT_TYPE_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { getPayerUrl } from 'utils/lib/helpers/helpers';
import { describe, expect, it, vi } from 'vitest';
import {
  attachCoverageToClaim,
  BILLING_WORKING_COPY_TAG,
  buildClaimCoverageCopies,
  buildNoCoverageStub,
  fetchPatientCoverages,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../../../src/billing/shared';

// The shared patient-coverage helpers, used by both the claim detail coverage picker
// (get-patient-coverages / update-billing-claim's attach) and the rules engine's
// "Coverage (from patient)" prefetch and writer. Testing them here covers both callers.

const PATIENT_ID = 'src-patient';

const primaryCoverage: Coverage = {
  resourceType: 'Coverage',
  id: 'cov-primary',
  status: 'active',
  beneficiary: { reference: `Patient/${PATIENT_ID}` },
  subscriber: { reference: 'RelatedPerson/rp-1' },
  subscriberId: 'PRIM-001',
  payor: [{ reference: getPayerUrl('111222') }],
};
const secondaryCoverage: Coverage = {
  resourceType: 'Coverage',
  id: 'cov-secondary',
  status: 'active',
  beneficiary: { reference: `Patient/${PATIENT_ID}` },
  subscriber: { reference: `Patient/${PATIENT_ID}` },
  subscriberId: 'SEC-002',
  payor: [{ reference: getPayerUrl('333444') }],
};
const workersCompCoverage: Coverage = {
  resourceType: 'Coverage',
  id: 'cov-wc',
  status: 'active',
  beneficiary: { reference: `Patient/${PATIENT_ID}` },
  subscriber: { reference: `Patient/${PATIENT_ID}` },
  payor: [{ reference: getPayerUrl('999001') }],
};
// On the patient but not referenced by any billing account — not part of their insurance setup.
const unlinkedCoverage: Coverage = {
  resourceType: 'Coverage',
  id: 'cov-unlinked',
  status: 'active',
  beneficiary: { reference: `Patient/${PATIENT_ID}` },
  payor: [{ reference: getPayerUrl('555666') }],
};
const policyHolder: RelatedPerson = {
  resourceType: 'RelatedPerson',
  id: 'rp-1',
  patient: { reference: `Patient/${PATIENT_ID}` },
  name: [{ given: ['Sam'], family: 'Guardian' }],
  birthDate: '1975-02-02',
};

const accounts: Account[] = [
  {
    resourceType: 'Account',
    id: 'acct-pbill',
    status: 'active',
    type: { coding: [{ system: ACCOUNT_TYPE_CODE_SYSTEM, code: 'PBILLACCT' }] },
    subject: [{ reference: `Patient/${PATIENT_ID}` }],
    coverage: [
      { coverage: { reference: 'Coverage/cov-primary' }, priority: 1 },
      { coverage: { reference: 'Coverage/cov-secondary' }, priority: 2 },
    ],
  },
  {
    resourceType: 'Account',
    id: 'acct-wcomp',
    status: 'active',
    type: { coding: [{ system: ACCOUNT_TYPE_CODE_SYSTEM, code: 'WCOMPACCT' }] },
    subject: [{ reference: `Patient/${PATIENT_ID}` }],
    coverage: [{ coverage: { reference: 'Coverage/cov-wc' }, priority: 1 }],
  },
];

function makeOystehrMock(): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } {
  const search = vi.fn().mockImplementation(({ resourceType }: { resourceType: string }) => {
    if (resourceType === 'Coverage') {
      return Promise.resolve({
        unbundle: () => [unlinkedCoverage, workersCompCoverage, primaryCoverage, secondaryCoverage],
      });
    }
    if (resourceType === 'RelatedPerson') return Promise.resolve({ unbundle: () => [policyHolder] });
    if (resourceType === 'Account') return Promise.resolve({ unbundle: () => accounts });
    return Promise.resolve({ unbundle: () => [] });
  });
  return { oystehr: { fhir: { search } } as unknown as Oystehr, search };
}

describe('fetchPatientCoverages', () => {
  it("returns the patient's account-referenced coverages with their slot and policy holder", async () => {
    const { oystehr } = makeOystehrMock();

    const records = await fetchPatientCoverages(oystehr, PATIENT_ID);

    // The unlinked coverage is dropped: only coverages an account references are billing coverages.
    expect(records.map((r) => r.coverage.id)).toEqual(['cov-wc', 'cov-primary', 'cov-secondary']);
    expect(records.map((r) => r.insuranceType)).toEqual(['workersComp', 'primary', 'secondary']);
    // The standalone policy holder is resolved; self-subscribed coverages carry none.
    expect(records.find((r) => r.coverage.id === 'cov-primary')?.subscriber?.id).toBe('rp-1');
    expect(records.find((r) => r.coverage.id === 'cov-secondary')?.subscriber).toBeUndefined();
  });

  it('scopes every lookup to the patient and excludes per-claim working copies', async () => {
    const { oystehr, search } = makeOystehrMock();

    await fetchPatientCoverages(oystehr, PATIENT_ID);

    const excludeWorkingCopies = {
      name: '_tag:not',
      value: `${BILLING_WORKING_COPY_TAG.system}|${BILLING_WORKING_COPY_TAG.code}`,
    };
    const callFor = (resourceType: string): { params: { name: string; value: string }[] } =>
      search.mock.calls.map((call) => call[0]).find((arg) => arg.resourceType === resourceType);

    expect(callFor('Coverage').params).toEqual(
      expect.arrayContaining([{ name: 'beneficiary', value: `Patient/${PATIENT_ID}` }, excludeWorkingCopies])
    );
    expect(callFor('RelatedPerson').params).toEqual(
      expect.arrayContaining([{ name: 'patient', value: `Patient/${PATIENT_ID}` }, excludeWorkingCopies])
    );
    expect(callFor('Account').params).toEqual(
      expect.arrayContaining([{ name: 'subject', value: `Patient/${PATIENT_ID}` }, excludeWorkingCopies])
    );
  });

  it('reports a tertiary coverage on an account correctly', async () => {
    const { oystehr, search } = makeOystehrMock();
    search.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Coverage') return Promise.resolve({ unbundle: () => [primaryCoverage] });
      if (resourceType === 'Account') {
        return Promise.resolve({
          unbundle: () => [
            {
              ...accounts[0],
              // Priority 3 is not one of the primary/secondary placements.
              coverage: [{ coverage: { reference: 'Coverage/cov-primary' }, priority: 3 }],
            },
          ],
        });
      }
      return Promise.resolve({ unbundle: () => [] });
    });

    const records = await fetchPatientCoverages(oystehr, PATIENT_ID);

    // Still returned (the claim detail picker lists it), but it occupies no slot the rules can name.
    expect(records).toHaveLength(1);
    expect(records[0].insuranceType).toBe('tertiary');
  });
});

describe('buildClaimCoverageCopies', () => {
  it("re-points the coverage copy at the claim's patient and copies the policy holder", () => {
    const { coverage, subscriber } = buildClaimCoverageCopies({
      coverage: primaryCoverage,
      subscriber: policyHolder,
      patientReference: 'Patient/claim-patient',
    });

    // Working copies of the originals, stamped with their source so later reads can map back.
    expect(coverage.id).toBeUndefined();
    expect(coverage.meta?.tag).toContainEqual(BILLING_WORKING_COPY_TAG);
    expect(coverage.extension).toContainEqual({
      url: SOURCE_IDENTIFIER_SYSTEM,
      valueReference: { reference: 'Coverage/cov-primary' },
    });
    expect(coverage.subscriberId).toBe('PRIM-001');
    expect(coverage.beneficiary).toEqual({ reference: 'Patient/claim-patient' });

    expect(subscriber?.id).toBeUndefined();
    expect(subscriber?.meta?.tag).toContainEqual(BILLING_WORKING_COPY_TAG);
    expect(subscriber?.patient).toEqual({ reference: 'Patient/claim-patient' });
    expect(subscriber?.name?.[0]?.given).toEqual(['Sam']);
    // The coverage's subscriber defaults to the patient; the caller links the copy once it has a
    // reference (a created id in the claim editor, a urn placeholder in the rules engine).
    expect(coverage.subscriber).toEqual({ reference: 'Patient/claim-patient' });

    // The originals are untouched.
    expect(primaryCoverage.beneficiary).toEqual({ reference: `Patient/${PATIENT_ID}` });
    expect(policyHolder.patient).toEqual({ reference: `Patient/${PATIENT_ID}` });
  });

  it('points a self-subscribed coverage at the patient and makes no policy-holder copy', () => {
    const { coverage, subscriber } = buildClaimCoverageCopies({
      coverage: secondaryCoverage,
      patientReference: 'Patient/claim-patient',
    });

    expect(coverage.beneficiary).toEqual({ reference: 'Patient/claim-patient' });
    expect(coverage.subscriber).toEqual({ reference: 'Patient/claim-patient' });
    expect(subscriber).toBeUndefined();
  });

  it("keeps the original's references when the claim has no patient reference", () => {
    const { coverage, subscriber } = buildClaimCoverageCopies({
      coverage: primaryCoverage,
      subscriber: policyHolder,
      patientReference: undefined,
    });

    expect(coverage.beneficiary).toEqual({ reference: `Patient/${PATIENT_ID}` });
    expect(coverage.subscriber).toEqual({ reference: 'RelatedPerson/rp-1' });
    expect(subscriber).toBeUndefined();
  });
});

describe('attachCoverageToClaim', () => {
  // No `as Claim` assertion: annotating the return type checks the literal against Claim, so a
  // missing required element (created, here) fails the build instead of being cast away.
  const makeClaim = (insurance: Claim['insurance']): Claim => ({
    resourceType: 'Claim',
    id: 'claim-1',
    status: 'draft',
    use: 'claim',
    type: { coding: [] },
    patient: { reference: 'Patient/claim-patient' },
    created: '2026-01-01',
    provider: {},
    priority: { coding: [] },
    insurance,
  });

  it('makes the coverage the focal entry, keeps the secondary, and re-points the insurer', () => {
    const claim = makeClaim([
      { sequence: 1, focal: true, coverage: { reference: 'Coverage/old-primary' } },
      { sequence: 2, focal: false, coverage: { reference: 'Coverage/keep-secondary' } },
    ]);

    attachCoverageToClaim({
      claim,
      coverageReference: 'Coverage/new-primary',
      type: 'primary',
      display: 'Prime Health (111222)',
      payerReference: getPayerUrl('111222'),
    });

    expect(claim.insurance).toEqual([
      {
        sequence: 1,
        focal: true,
        coverage: { reference: 'Coverage/new-primary', display: 'Prime Health (111222)' },
      },
      { sequence: 2, focal: false, coverage: { reference: 'Coverage/keep-secondary' } },
    ]);
    expect(claim.insurer).toEqual({ reference: getPayerUrl('111222'), display: 'Prime Health (111222)' });
  });

  it('drops the no-coverage stub when a real coverage is attached to a self-pay claim', () => {
    const claim = makeClaim([buildNoCoverageStub()]);

    attachCoverageToClaim({
      claim,
      coverageReference: 'Coverage/new-primary',
      type: 'primary',
      display: 'Prime Health',
    });

    expect(claim.insurance).toHaveLength(1);
    expect(claim.insurance?.[0]?.coverage?.reference).toBe('Coverage/new-primary');
    // No payer reference given, so the insurer is left alone.
    expect(claim.insurer).toBeUndefined();
  });
});
