import { Organization, RelatedPerson } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  buildBillingCoverage,
  COVERAGE_SUBSCRIBER_CONTAINED_ID,
  setCoverageSubscriber,
} from '../../../src/billing/shared';

const PATIENT_ID = 'patient-123';

// Payer with a non-UUID id so the payor reference resolves to an RCM payer URL rather than Organization/<id>.
const payerOrg: Organization = {
  resourceType: 'Organization',
  id: 'rcm-payer-1',
  name: 'Acme Health Plan',
  identifier: [{ system: 'https://identifiers.fhir.oystehr.com/rcm-payer-id', value: 'PAYER123' }],
};

const spousePolicyHolder = {
  firstName: 'Jane',
  middleName: 'Q',
  lastName: 'Doe',
  dob: '1980-05-01',
  birthSex: 'Female' as const,
  address: { line1: '10 Main St', city: 'Boston', state: 'MA', postalCode: '02118' },
};

describe('buildBillingCoverage', () => {
  it('builds a self coverage pointing the subscriber at the patient with no contained policy holder', () => {
    const coverage = buildBillingCoverage({
      patientId: PATIENT_ID,
      payerOrg,
      memberId: 'M1',
      status: 'active',
      insuranceType: 'primary',
      relationship: 'Self',
    });

    expect(coverage.resourceType).toBe('Coverage');
    expect(coverage.status).toBe('active');
    expect(coverage.order).toBe(1);
    expect(coverage.beneficiary?.reference).toBe(`Patient/${PATIENT_ID}`);
    expect(coverage.subscriber?.reference).toBe(`Patient/${PATIENT_ID}`);
    expect(coverage.subscriberId).toBe('M1');
    expect(coverage.contained).toBeUndefined();
    expect(coverage.relationship?.coding?.[0]).toMatchObject({
      system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
      code: 'self',
      display: 'Self',
    });
    // Non-UUID payer id -> RCM payer URL.
    expect(coverage.payor?.[0]?.reference).toContain('PAYER123');
    expect(coverage.class?.[0]?.value).toBe('PAYER123');
    expect(coverage.class?.[0]?.name).toBe('Acme Health Plan');
    expect(coverage.identifier?.[0]?.value).toBe('M1');
  });

  it('builds a non-self coverage with a contained RelatedPerson policy holder', () => {
    const coverage = buildBillingCoverage({
      patientId: PATIENT_ID,
      payerOrg,
      memberId: 'M2',
      status: 'active',
      insuranceType: 'secondary',
      relationship: 'Spouse',
      policyHolder: spousePolicyHolder,
    });

    expect(coverage.order).toBe(2);

    expect(coverage.subscriber?.reference).toBe(`#${COVERAGE_SUBSCRIBER_CONTAINED_ID}`);
    expect(coverage.relationship?.coding?.[0]?.code).toBe('spouse');

    const contained = coverage.contained?.[0] as RelatedPerson;
    expect(contained?.resourceType).toBe('RelatedPerson');
    expect(contained?.id).toBe(COVERAGE_SUBSCRIBER_CONTAINED_ID);
    expect(contained?.name?.[0]?.given).toEqual(['Jane', 'Q']);
    expect(contained?.name?.[0]?.family).toBe('Doe');
    expect(contained?.gender).toBe('female');
    expect(contained?.birthDate).toBe('1980-05-01');
    expect(contained?.patient?.reference).toBe(`Patient/${PATIENT_ID}`);
    expect(contained?.address?.[0]?.line).toEqual(['10 Main St']);
    expect(contained?.relationship?.[0]?.coding?.[0]).toMatchObject({
      system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
      code: 'spouse',
    });
  });

  it('marks a workers comp coverage with the WC plan-type coding and no order', () => {
    const coverage = buildBillingCoverage({
      patientId: PATIENT_ID,
      payerOrg,
      memberId: 'WC1',
      status: 'active',
      insuranceType: 'workersComp',
      relationship: 'Self',
    });

    expect(coverage.order).toBeUndefined();
    expect(coverage.type?.coding).toContainEqual({
      system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
      code: 'WC',
    });
  });
});

describe('setCoverageSubscriber', () => {
  it('drops the contained policy holder when switching a coverage back to Self', () => {
    const coverage = buildBillingCoverage({
      patientId: PATIENT_ID,
      payerOrg,
      memberId: 'M3',
      status: 'active',
      insuranceType: 'primary',
      relationship: 'Child',
      policyHolder: { ...spousePolicyHolder, firstName: 'Kid' },
    });
    expect(coverage.contained).toHaveLength(1);

    setCoverageSubscriber(coverage, PATIENT_ID, 'Self');

    expect(coverage.subscriber?.reference).toBe(`Patient/${PATIENT_ID}`);
    expect(coverage.contained).toBeUndefined();
    expect(coverage.relationship?.coding?.[0]?.code).toBe('self');
  });
});
