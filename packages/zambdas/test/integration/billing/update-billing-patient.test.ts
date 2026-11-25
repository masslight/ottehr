import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, FhirResource, Patient, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { CLAIM_PROVENANCE_ACTIVITY } from 'utils/lib/types/data/billing/claim-history';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('update-billing-patient', () => {
  let billing: Oystehr;
  let caller: Oystehr;
  let callerProfile: string;
  let processId: string;
  let cleanup: () => Promise<void>;
  const deletes: BatchInputDeleteRequest[] = [];
  let patientId: string;
  let claimId: string;

  const seed = async <T extends FhirResource>(resource: T): Promise<T & { id: string }> => {
    const created = await billing.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    deletes.push({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T & { id: string };
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/update-billing-patient.test.ts',
      M2MClientMockType.provider
    );
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const patient = await seed<Patient>({
      resourceType: 'Patient',
      name: [{ given: ['Before'], family: 'Rename' }],
      birthDate: '1980-01-01',
      telecom: [{ system: 'phone', value: '+12025550100' }],
    });
    patientId = patient.id;
    const claim = await seed<Claim>({
      resourceType: 'Claim',
      status: 'draft',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      patient: { reference: `Patient/${patientId}` },
      created: '2026-01-01',
      provider: { display: 'Unknown' },
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
    });
    claimId = claim.id;
  }, 120_000);

  afterAll(async () => {
    const provenances = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claimId}` }],
      })
    ).unbundle();
    await billing.fhir.batch({
      requests: [
        ...provenances.map(
          (provenance): BatchInputDeleteRequest => ({ method: 'DELETE', url: `Provenance/${provenance.id}` })
        ),
        ...deletes.reverse(),
      ],
    });
    await cleanup();
  }, 120_000);

  it("updates the claim's patient and records the change in that claim's history", async () => {
    const lastName = `Integration${randomUUID().slice(0, 8)}`;
    const { output } = await caller.zambda.execute({
      id: 'update-billing-patient',
      patientId,
      claimId,
      firstName: 'After',
      lastName,
      dob: '1990-02-03',
      gender: 'female',
      phone: '+12025550199',
      email: 'integration-patient@example.com',
      address: { line1: '1 Main St', city: 'Albany', state: 'NY', postalCode: '12207' },
    });
    expect(output).toEqual({ id: patientId });

    const patient = await billing.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });
    expect(patient.name).toEqual([{ given: ['After'], family: lastName }]);
    expect(patient.birthDate).toBe('1990-02-03');
    expect(patient.gender).toBe('female');
    expect(patient.telecom).toEqual([
      { system: 'phone', value: '+12025550199' },
      { system: 'email', value: 'integration-patient@example.com' },
    ]);
    expect(patient.address).toEqual([{ line: ['1 Main St'], city: 'Albany', state: 'NY', postalCode: '12207' }]);

    const history = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claimId}` }],
      })
    ).unbundle();
    expect(history).toHaveLength(1);
    expect(history[0].target.map((target) => target.reference)).toEqual([`Patient/${patientId}`, `Claim/${claimId}`]);
    expect(history[0].activity?.coding).toContainEqual(CLAIM_PROVENANCE_ACTIVITY.update);
    expect(history[0].agent.map((agent) => agent.who?.reference)).toEqual([callerProfile]);
  }, 60_000);
});
