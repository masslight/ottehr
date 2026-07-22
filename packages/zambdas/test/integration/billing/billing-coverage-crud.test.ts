import Oystehr from '@oystehr/sdk';
import { Account, Coverage, Patient, RelatedPerson } from 'fhir/r4b';
import {
  BillingPayerOption,
  CreateBillingCoverageInput,
  CreatedResourceResponse,
  DeletedResponse,
  GetPatientCoveragesResponse,
  M2MClientMockType,
  SavedResourceResponse,
  SearchBillingPayersResponse,
  UpdateBillingCoverageInput,
} from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

// Happy-path coverage CRUD for the billing app's Patient details Insurance tab. Exercises each of the
// new zambdas in sequence (create -> get -> update -> delete) against a seeded billing patient and a
// real RCM payer.
describe('billing coverage CRUD', () => {
  let oystehr: Oystehr; // admin FHIR client used to seed / assert / clean up
  let cleanup: () => Promise<void>;
  let processId: string;

  let patientId: string;
  let payer: BillingPayerOption;
  let coverageId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/billing-coverage-crud.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehrBilling;
    cleanup = setup.cleanup;
    processId = setup.processId;

    const patient = await oystehr.fhir.create<Patient>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Patient',
          active: true,
          name: [{ family: 'CoverageCrud', given: ['Integration'] }],
          birthDate: '1990-01-01',
        } as Patient,
        processId
      ) as Patient
    );
    patientId = patient.id!;

    const payersResponse = (await oystehr.zambda.execute({ id: 'search-billing-payers' }))
      .output as SearchBillingPayersResponse;
    expect(payersResponse.payers.length).toBeGreaterThan(0);
    payer = payersResponse.payers[0];
  }, 90_000);

  afterAll(async () => {
    // The coverage zambdas create Coverage / Account / RelatedPerson resources that aren't part of an
    // appointment graph, so delete them explicitly (best-effort) before the shared cleanup.
    for (const resourceType of ['Coverage', 'Account', 'RelatedPerson'] as const) {
      try {
        const param = resourceType === 'Account' ? 'subject' : resourceType === 'Coverage' ? 'beneficiary' : 'patient';
        const resources = (
          await oystehr.fhir.search<Account | Coverage | RelatedPerson>({
            resourceType,
            params: [{ name: param, value: `Patient/${patientId}` }],
          })
        ).unbundle();
        await Promise.all(
          resources.map((r) => oystehr.fhir.delete({ resourceType, id: r.id! }).catch(() => undefined))
        );
      } catch {
        // best-effort cleanup
      }
    }
    try {
      if (patientId) await oystehr.fhir.delete({ resourceType: 'Patient', id: patientId });
    } catch {
      // best-effort cleanup
    }
    await cleanup();
  }, 90_000);

  it('create-billing-coverage creates a primary coverage linked to the billing account', async () => {
    const input: CreateBillingCoverageInput = {
      patientId,
      payerId: payer.id,
      memberId: 'MEMBER-001',
      insuranceType: 'primary',
      relationship: 'Self',
    };
    const { id } = (await oystehr.zambda.execute({ id: 'create-billing-coverage', ...input }))
      .output as CreatedResourceResponse;
    expect(id).toBeTruthy();
    coverageId = id;

    const coverage = await oystehr.fhir.get<Coverage>({ resourceType: 'Coverage', id });
    expect(coverage.status).toBe('active');
    expect(coverage.beneficiary?.reference).toBe(`Patient/${patientId}`);
    // Self subscriber points at the patient (no standalone RelatedPerson).
    expect(coverage.subscriber?.reference).toBe(`Patient/${patientId}`);
    expect(coverage.subscriberId).toBe('MEMBER-001');

    // Primary lives in the patient billing account (PBILLACCT) at priority 1.
    const accounts = (
      await oystehr.fhir.search<Account>({
        resourceType: 'Account',
        params: [{ name: 'subject', value: `Patient/${patientId}` }],
      })
    ).unbundle();
    const billingAccount = accounts.find((acc) => acc.type?.coding?.some((c) => c.code === 'PBILLACCT'));
    expect(billingAccount?.coverage).toContainEqual(
      expect.objectContaining({ coverage: { reference: `Coverage/${id}` }, priority: 1 })
    );
  }, 90_000);

  it('get-patient-coverages returns the created coverage with its insurance type', async () => {
    const response = (await oystehr.zambda.execute({ id: 'get-patient-coverages', patientId }))
      .output as GetPatientCoveragesResponse;

    const found = response.coverages.find((c) => c.id === coverageId);
    expect(found).toBeDefined();
    expect(found?.insuranceType).toBe('primary');
    expect(found?.relationship).toBe('Self');
    expect(found?.memberId).toBe('MEMBER-001');
    expect(found?.payorId).toBe(payer.payerId);
    expect(found?.policyHolder).toBeNull();
  }, 90_000);

  it('update-billing-coverage updates the member id and switches the subscriber to a standalone RelatedPerson', async () => {
    const input: UpdateBillingCoverageInput = {
      coverageId,
      memberId: 'MEMBER-002',
      insuranceType: 'primary',
      relationship: 'Spouse',
      policyHolder: {
        firstName: 'Jane',
        lastName: 'Doe',
        dob: '1985-03-02',
        gender: 'female',
        address: { line1: '1 Main St', city: 'Boston', state: 'MA', postalCode: '02118' },
      },
    };
    const { id } = (await oystehr.zambda.execute({ id: 'update-billing-coverage', ...input }))
      .output as SavedResourceResponse;
    expect(id).toBe(coverageId);

    const coverage = await oystehr.fhir.get<Coverage>({ resourceType: 'Coverage', id: coverageId });
    expect(coverage.subscriberId).toBe('MEMBER-002');
    expect(coverage.relationship?.coding?.[0]?.code).toBe('spouse');
    // Non-self subscriber is a standalone RelatedPerson reference, not a contained resource.
    const subscriberRef = coverage.subscriber?.reference ?? '';
    expect(subscriberRef.startsWith('RelatedPerson/')).toBe(true);
    expect(coverage.contained ?? []).toHaveLength(0);

    const relatedPerson = await oystehr.fhir.get<RelatedPerson>({
      resourceType: 'RelatedPerson',
      id: subscriberRef.split('/')[1],
    });
    expect(relatedPerson.name?.[0]?.family).toBe('Doe');
    expect(relatedPerson.patient?.reference).toBe(`Patient/${patientId}`);

    // The enriched read reflects the policy holder.
    const response = (await oystehr.zambda.execute({ id: 'get-patient-coverages', patientId }))
      .output as GetPatientCoveragesResponse;
    const found = response.coverages.find((c) => c.id === coverageId);
    expect(found?.relationship).toBe('Spouse');
    expect(found?.policyHolder?.lastName).toBe('Doe');
  }, 90_000);

  it('delete-billing-coverage hard-deletes the coverage and its subscriber', async () => {
    const coverageBefore = await oystehr.fhir.get<Coverage>({ resourceType: 'Coverage', id: coverageId });
    const subscriberId = coverageBefore.subscriber?.reference?.split('/')[1];

    const result = (await oystehr.zambda.execute({ id: 'delete-billing-coverage', coverageId }))
      .output as DeletedResponse;
    expect(result.deleted).toBe(true);

    // Coverage is gone from the patient's coverage list and from FHIR.
    const response = (await oystehr.zambda.execute({ id: 'get-patient-coverages', patientId }))
      .output as GetPatientCoveragesResponse;
    expect(response.coverages.find((c) => c.id === coverageId)).toBeUndefined();
    await expect(oystehr.fhir.get<Coverage>({ resourceType: 'Coverage', id: coverageId })).rejects.toBeDefined();

    // The standalone RelatedPerson subscriber is deleted too.
    if (subscriberId) {
      await expect(
        oystehr.fhir.get<RelatedPerson>({ resourceType: 'RelatedPerson', id: subscriberId })
      ).rejects.toBeDefined();
    }

    // It is also unlinked from the billing account.
    const accounts = (
      await oystehr.fhir.search<Account>({
        resourceType: 'Account',
        params: [{ name: 'subject', value: `Patient/${patientId}` }],
      })
    ).unbundle();
    const stillLinked = accounts.some(
      (acc) => acc.coverage?.some((c) => c.coverage?.reference === `Coverage/${coverageId}`)
    );
    expect(stillLinked).toBe(false);
  }, 90_000);
});
