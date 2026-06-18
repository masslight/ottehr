import { Organization } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { buildBillingCoverage, buildSubscriberRelatedPerson } from '../../../src/billing/shared';

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
  it('builds a self coverage pointing the subscriber at the patient', () => {
    const coverage = buildBillingCoverage({
      patientId: PATIENT_ID,
      payerOrg,
      memberId: 'M1',
      status: 'active',
      insuranceType: 'primary',
      relationship: 'Self',
      subscriberReference: `Patient/${PATIENT_ID}`,
    });

    expect(coverage.resourceType).toBe('Coverage');
    expect(coverage.status).toBe('active');
    expect(coverage.order).toBe(1);
    expect(coverage.beneficiary?.reference).toBe(`Patient/${PATIENT_ID}`);
    expect(coverage.subscriber?.reference).toBe(`Patient/${PATIENT_ID}`);
    expect(coverage.subscriberId).toBe('M1');
    // No contained subscriber — non-self subscribers are standalone RelatedPerson resources.
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

  it('references a standalone RelatedPerson subscriber for a non-self coverage', () => {
    const coverage = buildBillingCoverage({
      patientId: PATIENT_ID,
      payerOrg,
      memberId: 'M2',
      status: 'active',
      insuranceType: 'secondary',
      relationship: 'Spouse',
      subscriberReference: 'RelatedPerson/rp-1',
    });

    expect(coverage.order).toBe(2);
    expect(coverage.subscriber?.reference).toBe('RelatedPerson/rp-1');
    expect(coverage.contained).toBeUndefined();
    expect(coverage.relationship?.coding?.[0]?.code).toBe('spouse');
  });

  it('marks a workers comp coverage with the WC plan-type coding and no order', () => {
    const coverage = buildBillingCoverage({
      patientId: PATIENT_ID,
      payerOrg,
      memberId: 'WC1',
      status: 'active',
      insuranceType: 'workersComp',
      relationship: 'Self',
      subscriberReference: `Patient/${PATIENT_ID}`,
    });

    expect(coverage.order).toBeUndefined();
    expect(coverage.type?.coding).toContainEqual({
      system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
      code: 'WC',
    });
  });
});

describe('buildSubscriberRelatedPerson', () => {
  it('builds a standalone RelatedPerson from policy holder details', () => {
    const subscriber = buildSubscriberRelatedPerson(PATIENT_ID, 'Spouse', spousePolicyHolder);

    expect(subscriber.resourceType).toBe('RelatedPerson');
    // No id / no contained marker — it is persisted as its own resource and referenced by the coverage.
    expect(subscriber.id).toBeUndefined();
    expect(subscriber.name?.[0]?.given).toEqual(['Jane', 'Q']);
    expect(subscriber.name?.[0]?.family).toBe('Doe');
    expect(subscriber.gender).toBe('female');
    expect(subscriber.birthDate).toBe('1980-05-01');
    expect(subscriber.patient?.reference).toBe(`Patient/${PATIENT_ID}`);
    expect(subscriber.address?.[0]?.line).toEqual(['10 Main St']);
    expect(subscriber.relationship?.[0]?.coding?.[0]).toMatchObject({
      system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
      code: 'spouse',
    });
  });
});
